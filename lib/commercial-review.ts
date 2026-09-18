import { prisma } from "./prisma";
import { getOrganisationMembership, getVisibleProjectsWhere } from "./organisation";
import { assessPotentialCommercialItem } from "./grok";
import { formatUserName } from "./user-display";

// ============================================================
// "Commercial Review" — a dashboard worklist ensuring every Project Diary
// entry eventually gets a commercial destination, or an explicit "No
// Action Required". See CommercialReviewItem's own schema comment for the
// full design rationale: this is a review QUEUE over an existing Update,
// never a new commercial entity — every real outcome (Variation/SI tag,
// QA record, Day Works category, Contract % checkpoint, "General") goes
// through 100% existing routes, untouched by this file.
//
// AI's role here is deliberately narrow: it enriches an ALREADY-pending
// "unassigned" item with a plain-English rationale for ranking/display —
// it never decides whether an item is shown at all. That decision is
// purely deterministic (see computePendingReason below), matching the
// product principle that Subbie HQ notices a missing commercial
// destination; the human decides what it means.
// ============================================================

// Going-forward only — entries posted before this feature shipped never
// generate a review item. No backfill, no one-time backlog dump against
// years of existing untagged diary entries.
const COMMERCIAL_REVIEW_LAUNCH_CUTOVER = new Date("2026-09-18T00:00:00.000Z");

// Cheap, deterministic, zero AI cost — used for ranking even before (or
// without) AI enrichment ever completing. Not a gate on visibility, just a
// signal: an entry mentioning scope-change language is ranked above one
// that doesn't, but both show up regardless.
const ADDITIONAL_WORK_KEYWORDS = [
  "additional",
  "extra",
  "requested",
  "instructed",
  "changed",
  "relocated",
  "removed",
  "added",
  "rework",
  "variation"
];

function hasAdditionalWorkLanguage(body: string): boolean {
  const lower = body.toLowerCase();
  return ADDITIONAL_WORK_KEYWORDS.some((keyword) => lower.includes(keyword));
}

type PendingReason = "unassigned" | "awaiting_percentage";

// The one place that decides "does this diary entry still need a
// commercial decision, and which kind" — purely from live state, no
// AI involved. Returns null once genuinely resolved via any existing
// tagging mechanism.
async function computePendingReason(update: {
  id: string;
  variationItemId: string | null;
  qaRecordId: string | null;
  category: string | null;
}): Promise<PendingReason | null> {
  const hasAnyTag = update.variationItemId != null || update.qaRecordId != null || update.category != null;

  if (!hasAnyTag) return "unassigned";

  if (update.category === "contract") {
    const [contractLinkCount, progressEntryCount] = await Promise.all([
      prisma.contractItemDiaryLink.count({ where: { updateId: update.id } }),
      prisma.contractItemProgressEntry.count({ where: { projectDiaryUpdateId: update.id } })
    ]);
    // Needs a look whenever EITHER a Contract Item hasn't actually been
    // picked yet, or one has but no % checkpoint has come from this entry
    // yet — both are "tagged Contract Work but not actually captured".
    if (contractLinkCount === 0 || progressEntryCount === 0) return "awaiting_percentage";
    return null;
  }

  // Tagged to a real Variation/SI, a QA record, or any other category —
  // fully resolved, regardless of what triggered this re-evaluation.
  return null;
}

// Called synchronously right after an Update is created (top-level only)
// or its tag is changed — cheap and deterministic, no AI. Upserts the
// review row with whatever the CURRENT correct reason is; never touches a
// row already marked no_action_required (that decision is permanent, see
// markCommercialReviewNoActionRequired). Safe to call redundantly — the
// unique updateId constraint means this can never create a second row for
// the same diary entry.
export async function evaluateUpdateForCommercialReview(updateId: string): Promise<void> {
  const update = await prisma.update.findUnique({
    where: { id: updateId },
    select: {
      id: true,
      projectId: true,
      parentId: true,
      createdAt: true,
      body: true,
      variationItemId: true,
      qaRecordId: true,
      category: true,
      _count: { select: { attachments: true } }
    }
  });
  if (!update) return;
  // Replies never carry their own tag (see the PATCH route's own rule) —
  // never eligible.
  if (update.parentId !== null) return;
  if (update.createdAt < COMMERCIAL_REVIEW_LAUNCH_CUTOVER) return;

  const existing = await prisma.commercialReviewItem.findUnique({ where: { updateId } });
  if (existing?.status === "no_action_required") return;

  const reason = await computePendingReason(update);
  if (reason === null) return;

  const hasRelatedCorrespondence = (await prisma.correspondence.count({ where: { sourceUpdateId: updateId } })) > 0;

  await prisma.commercialReviewItem.upsert({
    where: { updateId },
    create: {
      projectId: update.projectId,
      updateId,
      pendingReason: reason,
      attachmentCount: update._count.attachments,
      hasAdditionalWorkLanguage: hasAdditionalWorkLanguage(update.body),
      hasRelatedCorrespondence
    },
    update: {
      pendingReason: reason,
      attachmentCount: update._count.attachments,
      hasAdditionalWorkLanguage: hasAdditionalWorkLanguage(update.body),
      hasRelatedCorrespondence
    }
  });
}

// Fire-and-forget, called only for pendingReason = "unassigned" — an
// awaiting_percentage item needs no AI, it's a plain missing-number check.
// A failed call records detectionError (distinct from "AI genuinely found
// nothing to add") rather than silently leaving the row blank either way;
// the item still shows on the dashboard regardless, with a generic
// fallback reason if enrichment never completes — this is enrichment, not
// a gate.
export async function enrichCommercialReviewItemWithAi(commercialReviewItemId: string): Promise<void> {
  const item = await prisma.commercialReviewItem.findUnique({
    where: { id: commercialReviewItemId },
    include: { update: { select: { body: true, projectId: true } }, project: { select: { organisationId: true } } }
  });
  if (!item || item.pendingReason !== "unassigned") return;

  try {
    const result = await assessPotentialCommercialItem(
      {
        body: item.update.body,
        attachmentCount: item.attachmentCount,
        hasRelatedCorrespondence: item.hasRelatedCorrespondence
      },
      { organisationId: item.project.organisationId, contextRef: item.updateId }
    );

    await prisma.commercialReviewItem.update({
      where: { id: commercialReviewItemId },
      data: {
        aiSummary: result.rationale ?? null,
        aiConfidence: result.confidence ?? null,
        detectionError: null,
        detectedAt: new Date()
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown error";
    await prisma.commercialReviewItem
      .update({ where: { id: commercialReviewItemId }, data: { detectionError: message } })
      .catch(() => {});
  }
}

// Reliability net for enrichCommercialReviewItemWithAi's fire-and-forget
// invocation — same "no summary AND no error after a grace period is
// indistinguishable from 'never ran', safe to retry" reasoning as
// lib/inbound-email.ts's sweepUnclassifiedInboundEmails. Driven by a
// nightly Railway Cron Job (see app/api/cron/detect-commercial-items).
export async function sweepUnenrichedCommercialReviewItems(): Promise<{ found: number; ids: string[] }> {
  const cutoff = new Date(Date.now() - 10 * 60 * 1000);
  const stuck = await prisma.commercialReviewItem.findMany({
    where: {
      status: "pending_review",
      pendingReason: "unassigned",
      aiSummary: null,
      detectionError: null,
      createdAt: { lt: cutoff }
    },
    select: { id: true }
  });

  for (const { id } of stuck) {
    await enrichCommercialReviewItemWithAi(id);
  }

  return { found: stuck.length, ids: stuck.map((item) => item.id) };
}

export type CommercialReviewFeedItem = {
  id: string;
  projectId: string;
  projectName: string;
  updateId: string;
  pendingReason: PendingReason;
  bodyPreview: string;
  authorName: string;
  createdAt: Date;
  attachmentCount: number;
  hasAdditionalWorkLanguage: boolean;
  hasRelatedCorrespondence: boolean;
  aiSummary: string | null;
  aiConfidence: number | null;
  href: string;
};

const PREVIEW_LENGTH = 140;

function truncate(text: string, length: number): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= length) return collapsed;
  return `${collapsed.slice(0, length).trimEnd()}…`;
}

function rankScore(item: {
  pendingReason: PendingReason;
  hasAdditionalWorkLanguage: boolean;
  attachmentCount: number;
  hasRelatedCorrespondence: boolean;
  aiConfidence: number | null;
  createdAt: Date;
}): number {
  let score = 0;
  // A confirmed-but-incomplete Contract Work entry is further along than a
  // genuinely untagged one — surface it first.
  if (item.pendingReason === "awaiting_percentage") score += 3;
  if (item.hasAdditionalWorkLanguage) score += 2;
  if (item.attachmentCount > 0) score += 1;
  if (item.hasRelatedCorrespondence) score += 2;
  if (item.aiConfidence != null) score += item.aiConfidence * 2;
  // Mild age boost — older unreviewed items float up, matching the
  // existing dashboard's "overdue floats to top" convention.
  const ageDays = (Date.now() - item.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  score += Math.min(ageDays * 0.1, 2);
  return score;
}

// Same cross-project visibility rule as lib/dashboard.ts/lib/updates-feed.ts.
// Gated to isAdmin for v1 — the fuller Admin/Management/Site tiered role
// this really deserves doesn't exist yet (see the implementation plan's own
// note on this); an org-less legacy project user counts as "admin enough"
// here too, matching how every other org-gated dashboard section treats
// org-less projects as unrestricted. Exported separately (not just inlined
// into getActiveCommercialReviewItems below) so the dashboard page can
// decide whether to render the section AT ALL for a non-admin, rather than
// showing a misleading "All caught up" empty state to someone who simply
// isn't allowed to see this yet.
export async function canViewCommercialReview(userId: string): Promise<boolean> {
  const membership = await getOrganisationMembership(userId);
  return !membership || membership.isAdmin;
}

// `projectId` narrows to a single project's items — reused as-is by the
// per-project Profitability page (Commercial Gap panel) and the Portfolio
// Profitability dashboard's cross-project count, so neither has to
// duplicate this visibility/detection logic. Omitted, it behaves exactly
// as before (every visible project).
export async function getActiveCommercialReviewItems(
  userId: string,
  projectId?: string
): Promise<CommercialReviewFeedItem[]> {
  if (!(await canViewCommercialReview(userId))) return [];

  const projects = await prisma.project.findMany({
    where: { ...(await getVisibleProjectsWhere(userId)), ...(projectId ? { id: projectId } : {}) },
    select: { id: true, name: true }
  });
  if (projects.length === 0) return [];
  const projectNameById = new Map(projects.map((project) => [project.id, project.name]));

  const rows = await prisma.commercialReviewItem.findMany({
    where: { projectId: { in: projects.map((project) => project.id) }, status: "pending_review" },
    include: {
      update: {
        select: {
          id: true,
          body: true,
          createdAt: true,
          variationItemId: true,
          qaRecordId: true,
          category: true,
          author: { select: { firstName: true, lastName: true, email: true } }
        }
      }
    }
  });
  if (rows.length === 0) return [];

  // Live re-check — a row's stored pendingReason is only refreshed at the
  // two write hook points (Update create/PATCH); a Contract Works %
  // checkpoint can be recorded via a third route
  // (POST /contract-schedule/progress) that this feature deliberately
  // doesn't touch, so awaiting_percentage rows need their resolution
  // re-verified here rather than trusted stale.
  const feedItems: CommercialReviewFeedItem[] = [];
  for (const row of rows) {
    const reason = await computePendingReason(row.update);
    if (reason === null) continue;

    feedItems.push({
      id: row.id,
      projectId: row.projectId,
      projectName: projectNameById.get(row.projectId) ?? "",
      updateId: row.updateId,
      pendingReason: reason,
      bodyPreview: truncate(row.update.body, PREVIEW_LENGTH),
      authorName: formatUserName(row.update.author) ?? row.update.author.email,
      createdAt: row.update.createdAt,
      attachmentCount: row.attachmentCount,
      hasAdditionalWorkLanguage: row.hasAdditionalWorkLanguage,
      hasRelatedCorrespondence: row.hasRelatedCorrespondence,
      aiSummary: row.aiSummary,
      aiConfidence: row.aiConfidence,
      href: `/projects/${row.projectId}/updates?update=${row.updateId}`
    });
  }

  feedItems.sort(
    (a, b) =>
      rankScore({ ...b, pendingReason: b.pendingReason }) - rankScore({ ...a, pendingReason: a.pendingReason })
  );

  return feedItems;
}

export async function getActiveCommercialReviewCount(userId: string): Promise<number> {
  return (await getActiveCommercialReviewItems(userId)).length;
}

// The one write action this feature adds on top of every existing route —
// never touches the underlying Update. Permanent: a dismissed item is
// never re-evaluated again (see evaluateUpdateForCommercialReview's own
// early return), even if the diary entry's tag is later changed.
export async function markCommercialReviewNoActionRequired(
  itemId: string,
  userId: string,
  reason?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const item = await prisma.commercialReviewItem.findUnique({ where: { id: itemId } });
  if (!item) return { ok: false, error: "Item not found." };
  if (item.status === "no_action_required") return { ok: true };

  await prisma.commercialReviewItem.update({
    where: { id: itemId },
    data: {
      status: "no_action_required",
      noActionByUserId: userId,
      noActionAt: new Date(),
      noActionReason: reason?.trim() || null
    }
  });

  return { ok: true };
}
