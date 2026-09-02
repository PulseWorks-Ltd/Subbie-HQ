import crypto from "crypto";
import { prisma } from "./prisma";
import { sendExternalActionRequestEmail, sendHoursOnSiteApprovedEmail } from "./email";
import { formatUserName } from "./user-display";
import { EXTERNAL_ACTION_TYPE_LABELS, requiresValueSnapshot } from "./external-action-types";
import { computePackageTotals, computeSheetRecordTotal } from "./variation-package";
import type { ExternalActionChoice, ExternalActionType } from "@prisma/client";

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, per the task brief

export { requiresValueSnapshot };

export type ExternalActionValueSnapshot = {
  combinedTotal: number;
  labourTotal: number;
  materialsTotal: number;
  materialsMarkupTotal: number;
  plantTotal: number;
  dayWorksSheets: { fileName: string; createdAt: string }[];
  // Set only for a package-approval request (variationPackageId given) —
  // the previously-SENT-for-approval package's own frozen grandTotal, for
  // the cumulative + new-since-last framing (Request Approval). Null when
  // this is the first-ever approval request for this item, or for a non-
  // package request.
  previousPackage: { grandTotal: number; sentAt: string } | null;
  // Set only for an Hours on Site approval request (hoursOnSiteSheetId
  // given) — this feature carries no $ value of its own (hours/workers
  // only), so every $ field above stays zeroed for it; this is the actual
  // "what's being asked" data shown on the public page instead.
  hoursOnSite: {
    totalHours: number | null;
    workerNames: string[];
    startedAt: string;
    finishedAt: string | null;
    comments: string | null;
    variationItemReference: string | null;
    variationItemTitle: string | null;
  } | null;
};

// Single source of truth for the value/evidence breakdown shown on the
// public response page (Task 2.1) — reuses computePackageTotals, the
// existing shared "what does this item's Labour/Materials/Plant cost,
// combined" calculation, rather than re-deriving it. Called fresh both
// when drafting the message preview and again at actual send time (never
// trusts a client-supplied snapshot), so what's frozen onto the row is
// always what the DB actually held at the moment of sending.
//
// A Day Works Sheet-scoped request gets its OWN sheet's labour total only
// — materials/plant are item-level relations in this schema (not scoped
// to one sheet, see DayWorksMaterial/DayWorksPlant's own comments), so
// they're correctly left at 0 here rather than attributed to one sheet.
//
// A package-scoped request (variationPackageId given) is different again:
// approving a package means approving exactly what's IN that frozen PDF,
// so this uses the PACKAGE's OWN stored totals (frozen at generation
// time), never a live recomputation from the item's current (possibly
// since-changed) records.
export async function computeValueSnapshot(params: {
  projectId: string;
  variationItemId?: string;
  dayWorksSheetId?: string;
  variationPackageId?: string;
  hoursOnSiteSheetId?: string;
}): Promise<ExternalActionValueSnapshot> {
  if (params.hoursOnSiteSheetId) {
    const sheet = await prisma.hoursOnSiteSheet.findUnique({
      where: { id: params.hoursOnSiteSheetId },
      include: { workers: { include: { worker: true } }, variationItem: { select: { reference: true, title: true } } }
    });
    return {
      combinedTotal: 0,
      labourTotal: 0,
      materialsTotal: 0,
      materialsMarkupTotal: 0,
      plantTotal: 0,
      dayWorksSheets: [],
      previousPackage: null,
      hoursOnSite: sheet
        ? {
            totalHours: sheet.totalHours != null ? Number(sheet.totalHours) : null,
            workerNames: sheet.workers.map((w) => w.worker.name),
            startedAt: sheet.startedAt.toISOString(),
            finishedAt: sheet.finishedAt ? sheet.finishedAt.toISOString() : null,
            comments: sheet.comments,
            variationItemReference: sheet.variationItem?.reference ?? null,
            variationItemTitle: sheet.variationItem?.title ?? null
          }
        : null
    };
  }

  if (params.variationPackageId) {
    const pkg = await prisma.variationPackage.findUnique({ where: { id: params.variationPackageId } });
    if (!pkg) {
      return {
        combinedTotal: 0,
        labourTotal: 0,
        materialsTotal: 0,
        materialsMarkupTotal: 0,
        plantTotal: 0,
        dayWorksSheets: [],
        previousPackage: null,
        hoursOnSite: null
      };
    }
    // "Previously SENT", not "previously generated" — an internal re-
    // generation that was never actually sent for approval shouldn't count
    // as the comparison baseline for "what's new since we last asked".
    const previousSentAction = await prisma.externalAction.findFirst({
      where: { variationItemId: pkg.variationItemId, variationPackageId: { not: null } },
      orderBy: { sentAt: "desc" },
      include: { variationPackage: { select: { grandTotal: true } } }
    });
    return {
      combinedTotal: Number(pkg.grandTotal),
      labourTotal: Number(pkg.labourTotal),
      materialsTotal: Number(pkg.materialsTotal),
      materialsMarkupTotal: Number(pkg.materialsMarkupTotal),
      plantTotal: Number(pkg.plantTotal),
      dayWorksSheets: [],
      previousPackage: previousSentAction?.variationPackage
        ? { grandTotal: Number(previousSentAction.variationPackage.grandTotal), sentAt: previousSentAction.sentAt.toISOString() }
        : null,
      hoursOnSite: null
    };
  }

  if (params.dayWorksSheetId) {
    const [sheet, records] = await Promise.all([
      prisma.dayWorksSheet.findUnique({ where: { id: params.dayWorksSheetId }, select: { fileName: true, createdAt: true } }),
      prisma.dayWorksSheetRecord.findMany({ where: { dayWorksSheetId: params.dayWorksSheetId } })
    ]);
    const labourTotal = records.reduce((sum, record) => sum + (computeSheetRecordTotal(record.totalHours, record.ratePerHour) ?? 0), 0);
    return {
      combinedTotal: labourTotal,
      labourTotal,
      materialsTotal: 0,
      materialsMarkupTotal: 0,
      plantTotal: 0,
      dayWorksSheets: sheet ? [{ fileName: sheet.fileName, createdAt: sheet.createdAt.toISOString() }] : [],
      previousPackage: null,
      hoursOnSite: null
    };
  }

  const [sheetRecords, materials, plant, contractTerms, dayWorksSheets] = await Promise.all([
    prisma.dayWorksSheetRecord.findMany({ where: { variationItemId: params.variationItemId } }),
    prisma.dayWorksMaterial.findMany({ where: { variationItemId: params.variationItemId } }),
    prisma.dayWorksPlant.findMany({ where: { variationItemId: params.variationItemId } }),
    prisma.contractTerms.findUnique({ where: { projectId: params.projectId } }),
    prisma.dayWorksSheet.findMany({ where: { variationItemId: params.variationItemId }, select: { fileName: true, createdAt: true } })
  ]);
  const totals = computePackageTotals(sheetRecords, materials, plant, contractTerms);
  return {
    combinedTotal: totals.grandTotal,
    labourTotal: totals.labourTotal,
    materialsTotal: totals.materialsTotal,
    materialsMarkupTotal: totals.materialsMarkupTotal,
    plantTotal: totals.plantTotal,
    dayWorksSheets: dayWorksSheets.map((sheet) => ({ fileName: sheet.fileName, createdAt: sheet.createdAt.toISOString() })),
    previousPackage: null,
    hoursOnSite: null
  };
}

// Same SHA-256-of-a-32-byte-random-value pattern as
// lib/password-reset.ts's requestPasswordReset — only the hash is ever
// persisted, so this table can never itself leak a usable token.
function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

const GENERIC_INVALID_MESSAGE = "This link isn't valid. Please contact the sender for a new one.";

export type ExternalActionPublicContext = {
  type: ExternalActionType;
  message: string | null;
  valueSnapshot: ExternalActionValueSnapshot | null;
  // Present only for a Request Approval on a specific VariationPackage —
  // lets the public page offer a download link for the actual PDF being
  // approved (via a separate public, token-gated file route — never the
  // authenticated internal one).
  package: { fileName: string } | null;
  status: "pending" | "responded" | "expired";
  expiresAt: Date;
  recipientName: string | null;
  senderName: string;
  source:
    | { kind: "variation_item"; reference: string; title: string; description: string | null; isSiteInstruction: boolean }
    | { kind: "day_works_sheet"; fileName: string; createdAt: Date; itemReference: string; itemTitle: string }
    | {
        kind: "hours_on_site";
        startedAt: Date;
        finishedAt: Date | null;
        totalHours: number | null;
        workerNames: string[];
        comments: string | null;
        itemReference: string | null;
        itemTitle: string | null;
      };
  existingResponse: {
    choice: ExternalActionChoice | null;
    name: string | null;
    comment: string | null;
    respondedAt: Date;
  } | null;
};

// Shared by both the "draft the message" and "send the request" routes —
// resolves whichever attachment point was given to the Variations/Site
// Instructions module its item actually belongs to, for the module-access
// check both routes need to run.
export async function moduleForExternalActionTarget(
  projectId: string,
  target: { variationItemId?: string; dayWorksSheetId?: string }
): Promise<"variations" | "site_instructions" | null> {
  const itemId = target.variationItemId
    ? target.variationItemId
    : (
        await prisma.dayWorksSheet.findFirst({
          where: { id: target.dayWorksSheetId, variationItem: { projectId } },
          select: { variationItemId: true }
        })
      )?.variationItemId;
  if (!itemId) return null;
  const item = await prisma.variationItem.findFirst({ where: { id: itemId, projectId }, select: { type: true } });
  if (!item) return null;
  return item.type === "variation" ? "variations" : "site_instructions";
}

// Sends the request email FIRST, only persisting the ExternalAction (and
// its token) once the send actually succeeds — there's no other reason for
// this row to exist without ever having been sent, so unlike other
// "external" flows in this app (where the source row is created up front
// and sending is best-effort on top of it), a failed send here should
// never leave a dangling, never-delivered token behind.
export async function createAndSendExternalAction(params: {
  projectId: string;
  variationItemId?: string;
  dayWorksSheetId?: string;
  // Only valid alongside variationItemId — see ExternalAction.variationPackageId's
  // schema comment. Validated below to actually belong to that item.
  variationPackageId?: string;
  // Set ALONE (never alongside the three above) — see
  // ExternalAction.hoursOnSiteSheetId's schema comment.
  hoursOnSiteSheetId?: string;
  type: ExternalActionType;
  message?: string;
  recipient: { contactId?: string; email?: string };
  // FYI-only cc list — see ExternalAction.ccEmails and
  // sendExternalActionRequestEmail's cc param. Only ever populated by the
  // scheduling automation (lib/variation-schedule.ts); manual Request
  // Approval sends never pass this.
  ccEmails?: string[];
  sentByUserId: string;
  baseUrl: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const targetCount = [params.variationItemId, params.dayWorksSheetId, params.hoursOnSiteSheetId].filter(Boolean).length;
  if (targetCount !== 1) {
    return { ok: false, error: "Exactly one of a Variation/SI, a Day Works Sheet, or an Hours on Site sheet must be set." };
  }
  if (params.variationPackageId && (params.dayWorksSheetId || params.hoursOnSiteSheetId)) {
    return { ok: false, error: "A package approval must be on a Variation/SI, not a Day Works Sheet or Hours on Site sheet." };
  }

  const [sender, project] = await Promise.all([
    prisma.user.findUnique({ where: { id: params.sentByUserId }, select: { firstName: true, lastName: true, email: true } }),
    prisma.project.findUnique({ where: { id: params.projectId }, select: { name: true, mainContractorId: true } })
  ]);
  const senderName = (sender && formatUserName(sender)) ?? sender?.email ?? "Subbie HQ";

  let recipientEmail: string;
  let recipientName: string | null = null;
  let mainContractorContactId: string | undefined;

  // Same "resolve a saved contact to its CURRENT email server-side" rule as
  // External Updates (lib/external-update.ts) — never trust a client-
  // supplied email for a saved contact.
  if (params.recipient.contactId) {
    const contact = await prisma.mainContractorContact.findFirst({
      where: { id: params.recipient.contactId, mainContractorId: project?.mainContractorId ?? undefined }
    });
    if (!contact?.email) {
      return { ok: false, error: "This contact has no email on file." };
    }
    recipientEmail = contact.email;
    recipientName = contact.name;
    mainContractorContactId = contact.id;
  } else if (params.recipient.email) {
    recipientEmail = params.recipient.email;
  } else {
    return { ok: false, error: "Select a contact or enter an email address." };
  }

  let variationItemId = params.variationItemId;
  let sourceLabel: string;
  // Only populated by the hours-on-site branch below, for the
  // Correspondence entry's own variationItemId — deliberately NOT folded
  // into `variationItemId` itself, which becomes this ExternalAction row's
  // own variationItemId (see the schema comment: an hours-on-site approval
  // must stay out of the SI's own "External Actions" list, since it's
  // unambiguously an action on the sheet, not a generic action on the SI's
  // live state).
  let hoursOnSiteLinkedVariationItemId: string | undefined;
  if (params.hoursOnSiteSheetId) {
    const sheet = await prisma.hoursOnSiteSheet.findFirst({
      where: { id: params.hoursOnSiteSheetId, projectId: params.projectId },
      include: { variationItem: { select: { id: true, reference: true, title: true } } }
    });
    if (!sheet) {
      return { ok: false, error: "Hours on Site sheet not found." };
    }
    if (!sheet.finishedAt) {
      return { ok: false, error: "Finish the sheet before requesting approval." };
    }
    if (sheet.approvedAt) {
      return { ok: false, error: "This sheet has already been approved." };
    }
    hoursOnSiteLinkedVariationItemId = sheet.variationItem?.id;
    sourceLabel = sheet.variationItem
      ? `Hours on Site — ${sheet.variationItem.reference} — ${sheet.variationItem.title}`
      : `Hours on Site — ${sheet.comments ?? "General labour"}`;
  } else if (params.dayWorksSheetId) {
    const sheet = await prisma.dayWorksSheet.findFirst({
      where: { id: params.dayWorksSheetId, variationItem: { projectId: params.projectId } },
      include: { variationItem: { select: { id: true, reference: true, title: true } } }
    });
    if (!sheet) {
      return { ok: false, error: "Day Works Sheet not found." };
    }
    variationItemId = sheet.variationItemId;
    sourceLabel = `Day Works Sheet — ${sheet.variationItem.reference}`;
  } else {
    const item = await prisma.variationItem.findFirst({ where: { id: variationItemId, projectId: params.projectId } });
    if (!item) {
      return { ok: false, error: "Variation/Site Instruction not found." };
    }
    sourceLabel = `${item.reference} — ${item.title}`;

    if (params.variationPackageId) {
      const pkg = await prisma.variationPackage.findFirst({
        where: { id: params.variationPackageId, variationItemId: item.id }
      });
      if (!pkg) {
        return { ok: false, error: "Variation Package not found on this item." };
      }
      sourceLabel = `Variation Package for ${sourceLabel}`;
    }
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const responseUrl = `${params.baseUrl}/respond/${rawToken}`;
  const typeLabel = EXTERNAL_ACTION_TYPE_LABELS[params.type];

  try {
    await sendExternalActionRequestEmail({
      to: recipientEmail,
      recipientName,
      senderName,
      projectName: project?.name ?? "the project",
      sourceLabel,
      typeLabel,
      message: params.message,
      responseUrl,
      cc: params.ccEmails
    });
  } catch (error) {
    console.error("Failed to send External Action request email:", error);
    return { ok: false, error: "Could not send this request — check your connection and try again." };
  }

  // Frozen at the actual moment of sending, never trusting a client-
  // supplied figure — recomputed fresh here even though the request
  // composer already showed the sender a preview moments earlier (Task
  // 2.1), so what's shown to the recipient always matches what the DB
  // held at send time.
  const valueSnapshot = requiresValueSnapshot(params.type)
    ? await computeValueSnapshot({
        projectId: params.projectId,
        variationItemId,
        dayWorksSheetId: params.dayWorksSheetId,
        variationPackageId: params.variationPackageId,
        hoursOnSiteSheetId: params.hoursOnSiteSheetId
      })
    : null;

  const externalAction = await prisma.externalAction.create({
    data: {
      projectId: params.projectId,
      variationItemId,
      dayWorksSheetId: params.dayWorksSheetId,
      variationPackageId: params.variationPackageId,
      hoursOnSiteSheetId: params.hoursOnSiteSheetId,
      type: params.type,
      message: params.message,
      valueSnapshot: valueSnapshot ?? undefined,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      mainContractorContactId,
      recipientEmail,
      recipientName,
      ccEmails: params.ccEmails ?? [],
      sentByUserId: params.sentByUserId
    }
  });

  // Logged immediately at send time (Task 4.2) — updated in place once a
  // response comes in (see submitExternalActionResponse) so the whole
  // request-and-response exchange is ONE Correspondence entry.
  await prisma.correspondence.create({
    data: {
      projectId: params.projectId,
      variationItemId: variationItemId ?? hoursOnSiteLinkedVariationItemId,
      title: `${typeLabel} requested from ${recipientName ?? recipientEmail}`,
      source: "external_action",
      bodyText: params.message ?? `${typeLabel} requested for ${sourceLabel}.`,
      category: typeLabel,
      sourceExternalActionId: externalAction.id
    }
  });

  return { ok: true };
}

// Resolves a raw token for the PUBLIC response page — deliberately returns
// only the specific record's own reference/title/description (or sheet
// filename), never the project id, other items, or anything else from the
// organisation (Task 3.3). Lazily flips a stale "pending" row to "expired"
// on read, so the source record's own detail page (which reads `status`
// directly, not this function) stays accurate without needing a cron sweep.
export async function getExternalActionForToken(
  rawToken: string
): Promise<{ ok: true; context: ExternalActionPublicContext } | { ok: false; error: string }> {
  const action = await prisma.externalAction.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: {
      variationItem: { select: { reference: true, title: true, description: true, type: true } },
      dayWorksSheet: {
        select: { fileName: true, createdAt: true, variationItem: { select: { reference: true, title: true } } }
      },
      variationPackage: { select: { fileName: true } },
      hoursOnSiteSheet: {
        select: {
          startedAt: true,
          finishedAt: true,
          totalHours: true,
          comments: true,
          variationItem: { select: { reference: true, title: true } },
          workers: { select: { worker: { select: { name: true } } } }
        }
      },
      sentByUser: { select: { firstName: true, lastName: true, email: true } }
    }
  });

  if (!action) {
    return { ok: false, error: GENERIC_INVALID_MESSAGE };
  }

  let status = action.status;
  if (status === "pending" && action.expiresAt < new Date()) {
    status = "expired";
    await prisma.externalAction.update({ where: { id: action.id }, data: { status: "expired" } });
  }

  const senderName = (action.sentByUser && formatUserName(action.sentByUser)) ?? action.sentByUser.email;

  if (status === "expired") {
    return { ok: false, error: `This link has expired. Please contact ${senderName} for a new one.` };
  }

  const source = action.hoursOnSiteSheet
    ? ({
        kind: "hours_on_site" as const,
        startedAt: action.hoursOnSiteSheet.startedAt,
        finishedAt: action.hoursOnSiteSheet.finishedAt,
        totalHours: action.hoursOnSiteSheet.totalHours != null ? Number(action.hoursOnSiteSheet.totalHours) : null,
        workerNames: action.hoursOnSiteSheet.workers.map((w) => w.worker.name),
        comments: action.hoursOnSiteSheet.comments,
        itemReference: action.hoursOnSiteSheet.variationItem?.reference ?? null,
        itemTitle: action.hoursOnSiteSheet.variationItem?.title ?? null
      } as const)
    : action.dayWorksSheet
      ? ({
          kind: "day_works_sheet" as const,
          fileName: action.dayWorksSheet.fileName,
          createdAt: action.dayWorksSheet.createdAt,
          itemReference: action.dayWorksSheet.variationItem.reference,
          itemTitle: action.dayWorksSheet.variationItem.title
        } as const)
      : action.variationItem
        ? ({
            kind: "variation_item" as const,
            reference: action.variationItem.reference,
            title: action.variationItem.title,
            description: action.variationItem.description,
            isSiteInstruction: action.variationItem.type === "site_instruction"
          } as const)
        : null;

  if (!source) {
    // Shouldn't happen (exactly one is always set at creation), but never
    // surface an internal inconsistency as a raw error to a public visitor.
    return { ok: false, error: GENERIC_INVALID_MESSAGE };
  }

  return {
    ok: true,
    context: {
      type: action.type,
      message: action.message,
      valueSnapshot: (action.valueSnapshot as unknown as ExternalActionValueSnapshot | null) ?? null,
      package: action.variationPackage ? { fileName: action.variationPackage.fileName } : null,
      status,
      expiresAt: action.expiresAt,
      recipientName: action.recipientName,
      senderName,
      source,
      existingResponse:
        status === "responded" && action.respondedAt
          ? {
              choice: action.responseChoice,
              name: action.responseName,
              comment: action.responseComment,
              respondedAt: action.respondedAt
            }
          : null
    }
  };
}

export type SubmitExternalActionResponseInput = {
  choice?: "approved" | "rejected";
  name: string;
  comment?: string;
};

export async function submitExternalActionResponse(
  rawToken: string,
  input: SubmitExternalActionResponseInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const action = await prisma.externalAction.findUnique({ where: { tokenHash: hashToken(rawToken) } });
  if (!action) {
    return { ok: false, error: GENERIC_INVALID_MESSAGE };
  }
  if (action.status === "responded") {
    return { ok: false, error: "This link has already been used." };
  }
  if (action.expiresAt < new Date()) {
    await prisma.externalAction.update({ where: { id: action.id }, data: { status: "expired" } });
    return { ok: false, error: "This link has expired. Please contact the sender for a new one." };
  }

  if (!input.name.trim()) {
    return { ok: false, error: "Enter your name." };
  }

  let choice: ExternalActionChoice | null = null;
  if (action.type === "approve") {
    if (input.choice !== "approved" && input.choice !== "rejected") {
      return { ok: false, error: "Choose Approve or Reject." };
    }
    choice = input.choice;
  } else if (action.type === "reject") {
    if (!input.comment?.trim()) {
      return { ok: false, error: "Enter a reason." };
    }
    choice = "rejected";
  } else if (action.type === "comment") {
    if (!input.comment?.trim()) {
      return { ok: false, error: "Enter a comment." };
    }
  }

  const respondedAt = new Date();
  await prisma.externalAction.update({
    where: { id: action.id },
    data: {
      status: "responded",
      responseChoice: choice,
      responseName: input.name.trim(),
      responseComment: input.comment?.trim() || undefined,
      respondedAt
    }
  });

  const typeLabel = EXTERNAL_ACTION_TYPE_LABELS[action.type];
  const summary = [
    `— ${typeLabel} response from ${input.name.trim()} on ${respondedAt.toLocaleDateString("en-NZ")}`,
    choice ? `Selected: ${choice === "approved" ? "Approved" : "Rejected"}` : null,
    input.comment?.trim() ? `Comment: ${input.comment.trim()}` : null
  ]
    .filter(Boolean)
    .join("\n");

  const correspondence = await prisma.correspondence.findUnique({ where: { sourceExternalActionId: action.id } });
  if (correspondence) {
    await prisma.correspondence.update({
      where: { id: correspondence.id },
      data: { bodyText: `${correspondence.bodyText ?? ""}\n\n${summary}`.trim() }
    });
  }

  // Req 4/5 — the one genuinely new side effect this feature adds on top
  // of the existing ExternalAction mechanics: an approved Hours on Site
  // sheet is marked Approved (locking further edits, see
  // lib/hours-on-site.ts) and its creator gets a confirmation email. Every
  // other target type (VariationItem/DayWorksSheet/VariationPackage) is
  // untouched by a response today, and stays that way here.
  if (action.hoursOnSiteSheetId && choice === "approved") {
    const sheet = await prisma.hoursOnSiteSheet.update({
      where: { id: action.hoursOnSiteSheetId },
      data: {
        approvedAt: respondedAt,
        approvedByName: input.name.trim(),
        approvedByExternalActionId: action.id
      },
      include: {
        createdByUser: { select: { firstName: true, lastName: true, email: true } },
        project: { select: { name: true } },
        variationItem: { select: { reference: true, title: true } }
      }
    });

    const creatorName = formatUserName(sheet.createdByUser) ?? sheet.createdByUser.email;
    const sourceLabel = sheet.variationItem
      ? `Hours on Site — ${sheet.variationItem.reference} — ${sheet.variationItem.title}`
      : `Hours on Site — ${sheet.comments ?? "General labour"}`;
    const baseUrl = process.env.AUTH_URL ?? "";

    try {
      await sendHoursOnSiteApprovedEmail({
        to: sheet.createdByUser.email,
        creatorName,
        projectName: sheet.project.name,
        sourceLabel,
        approvedByName: input.name.trim(),
        sheetUrl: `${baseUrl}/m/dayworks/${sheet.projectId}/${sheet.id}`
      });
    } catch (error) {
      // Non-fatal — the approval itself is already recorded; a hiccup
      // sending the confirmation email shouldn't fail the recipient's
      // submission (they've already told the sheet's creator nothing about
      // whether their own click succeeded).
      console.error("Failed to send Hours on Site approval confirmation email:", error);
    }
  }

  return { ok: true };
}
