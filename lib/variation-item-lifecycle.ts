import { prisma } from "./prisma";
import { recordLifecycleEvent } from "./record-lifecycle-log";

// --- SI/Variation reference matching ------------------------------------

// Deterministic normalisation used ONLY for matching, never stored, never
// used to auto-merge records. "SI-241" / "SI 241" / "SI241" / "si-241" /
// "SI-0241" all normalise to "SI241" (strip everything but letters/digits,
// uppercase, then drop leading zeros off a trailing numeric run so a
// zero-padded variant matches its unpadded twin). A bare "241" normalises
// to "241" — deliberately NOT equal to "SI241" (see findSiteInstructionByReference's
// "possible matches" tier below for how that case is handled instead: as a
// suggestion requiring explicit user selection, never an automatic match).
export function normalizeReference(raw: string): string {
  const stripped = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return stripped.replace(/0*(\d+)$/, "$1");
}

export type SiteInstructionMatch = {
  id: string;
  reference: string;
  title: string;
  createdAt: string;
  closedAt: string | null;
  lastActivityAt: string;
};

export type SiteInstructionLookupResult =
  | { kind: "none" }
  | { kind: "exact"; match: SiteInstructionMatch }
  | { kind: "ambiguous"; candidates: SiteInstructionMatch[] };

async function toMatch(item: { id: string; reference: string; title: string; createdAt: Date; closedAt: Date | null }): Promise<SiteInstructionMatch> {
  const lastActivityAt = await lastActivityAtFor(item.id);
  return {
    id: item.id,
    reference: item.reference,
    title: item.title,
    createdAt: item.createdAt.toISOString(),
    closedAt: item.closedAt?.toISOString() ?? null,
    lastActivityAt: lastActivityAt.toISOString()
  };
}

// Scoped to ONE project (never across projects/companies — the same
// reference string in two different projects is not a collision) — looks
// across active AND closed rows, since a closed-SI hit is exactly the case
// this exists to catch. Exact normalised match against exactly one row is
// automatic/high-confidence; anything else that shares just the trailing
// numeric portion (e.g. a bare "241" typed against "SI241") is surfaced as
// an ambiguous set requiring explicit user selection — never auto-linked,
// per the "false-positive linking is worse than a missed suggestion" rule.
export async function findSiteInstructionByReference(
  projectId: string,
  reference: string
): Promise<SiteInstructionLookupResult> {
  const target = normalizeReference(reference);
  if (!target) return { kind: "none" };

  const candidates = await prisma.variationItem.findMany({
    where: { projectId, type: "site_instruction" },
    select: { id: true, reference: true, title: true, createdAt: true, closedAt: true }
  });

  const exact = candidates.filter((c) => normalizeReference(c.reference) === target);
  if (exact.length === 1) {
    return { kind: "exact", match: await toMatch(exact[0]) };
  }
  if (exact.length > 1) {
    // Shouldn't normally happen (would mean two rows already normalise
    // identically), but never silently pick one — surface as ambiguous.
    return { kind: "ambiguous", candidates: await Promise.all(exact.map(toMatch)) };
  }

  // Numeric-suffix-only overlap (e.g. "241" vs "SI241") — only offered when
  // the typed reference has no letters at all, so a real "SI241"-shaped
  // input never gets loosely matched against something unrelated that
  // happens to share trailing digits.
  const isNumericOnly = /^\d+$/.test(target);
  if (isNumericOnly) {
    const suffixMatches = candidates.filter((c) => normalizeReference(c.reference).endsWith(target));
    if (suffixMatches.length > 0) {
      return { kind: "ambiguous", candidates: await Promise.all(suffixMatches.map(toMatch)) };
    }
  }

  return { kind: "none" };
}

async function lastActivityAtFor(variationItemId: string): Promise<Date> {
  const [item, lastSheet, lastTask, lastUpdate, lastAllocation] = await Promise.all([
    prisma.variationItem.findUniqueOrThrow({ where: { id: variationItemId }, select: { createdAt: true } }),
    prisma.dayWorksSheet.findFirst({ where: { variationItemId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    prisma.task.findFirst({ where: { variationItemId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    prisma.update.findFirst({ where: { variationItemId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    prisma.variationItemClaimAllocation.findFirst({ where: { variationItemId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } })
  ]);
  const dates = [item.createdAt, lastSheet?.createdAt, lastTask?.createdAt, lastUpdate?.createdAt, lastAllocation?.createdAt].filter(
    (d): d is Date => d != null
  );
  return dates.reduce((latest, d) => (d > latest ? d : latest), item.createdAt);
}

// --- Closure review --------------------------------------------------

export type ClosureReviewCheck = { label: string; count: number };
export type ClosureReview = {
  checks: ClosureReviewCheck[];
  hasWarnings: boolean;
  lastActivityAt: string;
  claimMonthsReferenced: string[];
};

// Everything a "Close" action needs to know before it decides whether to
// warn — reused as-is by the close UI to render the brief's exact "2 Tasks
// remain open, 1 Variation is pending..." style summary, and by
// closeVariationItem itself to decide whether force is required.
export async function reviewVariationItemForClosure(variationItemId: string): Promise<ClosureReview> {
  const item = await prisma.variationItem.findUniqueOrThrow({
    where: { id: variationItemId },
    select: { variationCreatedAt: true, variationValue: true }
  });

  const [openTasks, unsignedDayWorks, allocations, lastActivityAt] = await Promise.all([
    prisma.task.count({ where: { variationItemId, status: { in: ["open", "in_progress"] } } }),
    prisma.externalAction.count({
      where: { dayWorksSheet: { variationItemId }, type: { in: ["sign", "confirm"] }, status: "pending" }
    }),
    prisma.variationItemClaimAllocation.findMany({
      where: { variationItemId },
      include: { paymentClaim: { select: { claimMonth: true } } }
    }),
    lastActivityAtFor(variationItemId)
  ]);

  const claimedTotal = allocations.reduce((sum, a) => sum + Number(a.amount), 0);
  const unclaimedBalance =
    item.variationCreatedAt && item.variationValue != null ? Math.max(0, Number(item.variationValue) - claimedTotal) : null;

  const checks: ClosureReviewCheck[] = [{ label: "Open linked Tasks", count: openTasks }];
  if (unclaimedBalance != null) {
    checks.push({ label: "Unclaimed Variation balance", count: unclaimedBalance > 0 ? 1 : 0 });
  }
  checks.push({ label: "Unsigned Day Works sheets", count: unsignedDayWorks });

  return {
    checks,
    hasWarnings: checks.some((c) => c.count > 0),
    lastActivityAt: lastActivityAt.toISOString(),
    claimMonthsReferenced: [...new Set(allocations.map((a) => a.paymentClaim.claimMonth))].sort()
  };
}

export type CloseResult = { ok: true } | { ok: false; warnings: ClosureReview };

// Closes a VariationItem — whether it's currently "just an SI" or "SI that
// has also become a Variation," this is the ONE closure dimension covering
// both (see the schema comment on VariationItem.closedAt). Never mutates
// `status` (the completion axis) — a `complete` item can stay open
// indefinitely, and closing never implies or requires completion.
export async function closeVariationItem(params: {
  variationItemId: string;
  userId: string;
  force?: boolean;
  note?: string;
}): Promise<CloseResult> {
  const review = await reviewVariationItemForClosure(params.variationItemId);
  if (review.hasWarnings && !params.force) {
    return { ok: false, warnings: review };
  }

  await prisma.variationItem.update({
    where: { id: params.variationItemId },
    data: { closedAt: new Date(), closedByUserId: params.userId }
  });

  const overrideSummary = review.hasWarnings
    ? `Closed despite: ${review.checks
        .filter((c) => c.count > 0)
        .map((c) => `${c.label} (${c.count})`)
        .join(", ")}`
    : null;

  await recordLifecycleEvent({
    entityType: "variation_item",
    entityId: params.variationItemId,
    eventType: "closed",
    userId: params.userId,
    previousState: "active",
    newState: "closed",
    note: params.note ?? overrideSummary
  });

  return { ok: true };
}

// Reactivation is always deliberate — either a person explicitly clicking
// Reactivate, or accepting the "Yes — Reactivate SI" prompt after the
// closed-SI resolver surfaces a match. Never resets `status`; whatever
// completion state the item was in when closed is exactly what it's in
// when reactivated. The PRIOR closed event is never modified — only a new
// `reactivated` row is added, so the full history (closed → reactivated →
// closed again, ...) is always intact.
export async function reactivateVariationItem(params: {
  variationItemId: string;
  userId: string;
  note?: string;
}): Promise<void> {
  await prisma.variationItem.update({
    where: { id: params.variationItemId },
    data: { closedAt: null, reactivatedAt: new Date(), reactivatedByUserId: params.userId }
  });

  await recordLifecycleEvent({
    entityType: "variation_item",
    entityId: params.variationItemId,
    eventType: "reactivated",
    userId: params.userId,
    previousState: "closed",
    newState: "active",
    note: params.note ?? null
  });
}

// Archive month — computed fresh every time, never stored or cached (see
// this function's own logic: it reads the CURRENT closedAt and the CURRENT
// full set of linked records, so a reactivate-then-reclose cycle correctly
// recomputes to reflect the LATEST closure, never a stale frozen value from
// a prior one). Returns null for an active (not currently closed) item —
// it has no archive placement because it isn't archived.
export async function archiveMonthFor(variationItemId: string): Promise<string | null> {
  const item = await prisma.variationItem.findUniqueOrThrow({
    where: { id: variationItemId },
    select: { closedAt: true, createdAt: true }
  });
  if (!item.closedAt) return null;

  const [sheets, tasks, allocations] = await Promise.all([
    prisma.dayWorksSheet.findMany({ where: { variationItemId }, select: { createdAt: true } }),
    prisma.task.findMany({ where: { variationItemId }, select: { createdAt: true } }),
    prisma.variationItemClaimAllocation.findMany({ where: { variationItemId }, include: { paymentClaim: { select: { claimMonth: true } } } })
  ]);

  const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const candidates = [
    ...sheets.map((s) => monthKey(s.createdAt)),
    ...tasks.map((t) => monthKey(t.createdAt)),
    ...allocations.map((a) => a.paymentClaim.claimMonth)
  ];

  if (candidates.length === 0) {
    // Documented fallback — nothing ever referenced this record; file it
    // under its own creation month.
    return monthKey(item.createdAt);
  }
  return candidates.sort().at(-1)!;
}
