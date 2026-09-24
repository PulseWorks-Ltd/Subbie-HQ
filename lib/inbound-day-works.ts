import type { InboundDayWorksMatchStatus, InboundDayWorksSheetAction } from "@prisma/client";
import { prisma } from "./prisma";
import { downloadFromS3, uploadToS3 } from "./s3";
import { renderPdfPagesToImages, UnreadablePdfError } from "./pdf-text-extraction";
import { extractDayWorksSheetSummariesFromImages } from "./grok";
import { AiSpendCapExceededError } from "./ai-usage";
import { normalizeReference, giveVariationIdentity } from "./variation-item-lifecycle";
import { descriptionSimilarity, DESCRIPTION_SIMILARITY_THRESHOLD } from "./payment-claim-import";

// ============================================================
// Batch Day Works email-in — a subcontractor forwards a scanned/photographed
// BATCH of Day Works dockets in one InboundEmail; this extracts every
// physical sheet across all its attachments, proposes which existing
// Variation/Site Instruction each belongs to, and holds that as a
// resumable draft (InboundDayWorksExtraction/InboundDayWorksExtractionSheet)
// until a human files (or ignores) each one — see those models' own schema
// comments. This file owns extraction, matching, and filing; nothing here
// invents a second Day Works data model — filing always produces a real
// DayWorksSheet/DayWorksSheetRecord, identical in shape to what the
// existing single-sheet upload flow already creates.
// ============================================================

// A real "scan and forward at month-end" attachment could be an arbitrarily
// large multi-page PDF binder. Chunking/stitching an oversized scan into
// multiple AI calls is explicitly out of scope for V1 (risk of double-
// counting/splitting a sheet across a chunk boundary) — instead, an
// attachment over this page count fails cleanly with a message asking the
// user to split it into a second email.
const MAX_PAGES_PER_ATTACHMENT = 20;

// A real-world batch means several large sequential vision calls in one
// run — a transient network/provider blip on any single one of them
// otherwise reads to the reviewer as "this document can't be read", which
// is misleading (the document is fine; it's usually just a one-off retry
// away from succeeding, as confirmed when the exact PDFs from a genuine
// failed run were re-extracted moments later without any changes). Never
// retries UnreadablePdfError (a real, deterministic problem with the file
// itself — retrying it wastes an AI call and can't succeed) or
// AiSpendCapExceededError (retrying can't fix a spend cap and would only
// burn more of it). Everything else — network errors, transient 5xx,
// occasional malformed JSON from the model — gets a couple of quick
// retries before this attachment is actually reported as failed.
const TRANSIENT_RETRY_DELAYS_MS = [2000, 5000];

async function withTransientRetries<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= TRANSIENT_RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof UnreadablePdfError || error instanceof AiSpendCapExceededError) {
        throw error;
      }
      lastError = error;
      const delay = TRANSIENT_RETRY_DELAYS_MS[attempt];
      if (delay != null) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

export async function startDayWorksExtraction(
  client: { inboundDayWorksExtraction: { create: typeof prisma.inboundDayWorksExtraction.create } },
  params: { emailId: string; projectId: string; createdByUserId: string }
) {
  return client.inboundDayWorksExtraction.create({
    data: {
      inboundEmailId: params.emailId,
      projectId: params.projectId,
      createdByUserId: params.createdByUserId
    }
  });
}

export type DayWorksSheetMatchResult = {
  matchStatus: InboundDayWorksMatchStatus;
  matchedVariationItemId: string | null;
  matchReason: string | null;
};

// Reference-first (reusing normalizeReference — the SAME normalisation
// already used by the SI closed-record resolver and Payment Claim Import),
// falling back to description similarity ONLY when no reference was read
// off the sheet at all. An explicit-but-unmatched reference is trusted as
// "new," never treated as a fuzzy-match candidate — the exact lesson
// learned (and fixed) in lib/payment-claim-import.ts's own matcher.
export async function matchVariationForDayWorksSheet(
  projectId: string,
  extractedSiReference: string | null,
  task: string | null
): Promise<DayWorksSheetMatchResult> {
  const candidates = await prisma.variationItem.findMany({
    where: { projectId },
    select: { id: true, reference: true, title: true }
  });

  if (extractedSiReference) {
    const target = normalizeReference(extractedSiReference);
    const exact = candidates.filter((c) => normalizeReference(c.reference) === target);
    if (exact.length === 1) {
      const rawMatches = exact[0].reference.trim().toUpperCase() === extractedSiReference.trim().toUpperCase();
      return {
        matchStatus: "matched",
        matchedVariationItemId: exact[0].id,
        matchReason: rawMatches
          ? `Exact reference match: ${extractedSiReference}`
          : `Normalized reference match: ${extractedSiReference} → ${exact[0].reference}`
      };
    }
    if (exact.length > 1) {
      return {
        matchStatus: "unresolved",
        matchedVariationItemId: null,
        matchReason: "Multiple existing records share this reference — please select the correct one."
      };
    }
    return { matchStatus: "new", matchedVariationItemId: null, matchReason: null };
  }

  if (!task) {
    return { matchStatus: "unresolved", matchedVariationItemId: null, matchReason: null };
  }

  const scored = candidates
    .map((candidate) => ({ candidate, score: descriptionSimilarity(candidate.title, task) }))
    .filter((s) => s.score >= DESCRIPTION_SIMILARITY_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 1) {
    return {
      matchStatus: "likely_match",
      matchedVariationItemId: scored[0].candidate.id,
      matchReason: "Likely match based on description similarity"
    };
  }
  if (scored.length > 1) {
    return {
      matchStatus: "unresolved",
      matchedVariationItemId: null,
      matchReason: "Multiple possible matches found — please select the correct record."
    };
  }
  return { matchStatus: "new", matchedVariationItemId: null, matchReason: null };
}

// Fire-and-forget, called right after fileInboundEmail's transaction
// commits (same pattern as classifyAndSuggest). Safe to call more than
// once against the same extraction — an attachment that already has AT
// LEast one InboundDayWorksExtractionSheet row is treated as already
// processed and skipped, so retryDayWorksExtraction (below) only ever
// fills in whatever genuinely failed, never re-extracts (and duplicates)
// an attachment that already succeeded.
export async function runDayWorksExtraction(extractionId: string): Promise<void> {
  const extraction = await prisma.inboundDayWorksExtraction.findUnique({
    where: { id: extractionId },
    include: {
      inboundEmail: { include: { attachments: true } },
      project: { select: { organisationId: true, contractTerms: { select: { dayWorksRateNormal: true } } } }
    }
  });
  if (!extraction) return;

  const defaultRatePerHour = extraction.project.contractTerms?.dayWorksRateNormal ?? null;
  const errors: string[] = [];
  let anySucceeded = false;

  for (const attachment of extraction.inboundEmail.attachments) {
    const alreadyProcessed = await prisma.inboundDayWorksExtractionSheet.count({
      where: { inboundEmailAttachmentId: attachment.id }
    });
    if (alreadyProcessed > 0) {
      anySucceeded = true;
      continue;
    }

    try {
      const buffer = await downloadFromS3(attachment.storageKey);

      let images: { dataUrl: string }[];
      if (attachment.contentType === "application/pdf") {
        const pages = await renderPdfPagesToImages(buffer);
        if (pages.length > MAX_PAGES_PER_ATTACHMENT) {
          errors.push(
            `${attachment.fileName}: ${pages.length} pages exceeds the ${MAX_PAGES_PER_ATTACHMENT}-page limit per attachment — please forward it as a separate, smaller email.`
          );
          continue;
        }
        images = pages.map((page) => ({ dataUrl: page.dataUrl }));
      } else if (attachment.contentType.startsWith("image/")) {
        const base64 = Buffer.from(buffer).toString("base64");
        images = [{ dataUrl: `data:${attachment.contentType};base64,${base64}` }];
      } else {
        errors.push(`${attachment.fileName}: this file type can't be read automatically.`);
        continue;
      }

      const summaries = await withTransientRetries(() =>
        extractDayWorksSheetSummariesFromImages(images, {
          organisationId: extraction.project.organisationId,
          userId: extraction.createdByUserId,
          contextRef: extractionId
        })
      );

      let sheetIndex = 0;
      for (const summary of summaries) {
        const match = await matchVariationForDayWorksSheet(extraction.projectId, summary.siReferenceOnSheet, summary.task);
        await prisma.inboundDayWorksExtractionSheet.create({
          data: {
            inboundDayWorksExtractionId: extractionId,
            inboundEmailAttachmentId: attachment.id,
            sheetIndexInAttachment: sheetIndex++,
            sheetNumber: summary.sheetNumber,
            teamLeaderCount: summary.teamLeaderCount,
            teamMemberCount: summary.teamMemberCount,
            totalHours: summary.totalHours,
            ratePerHour: defaultRatePerHour,
            date: summary.date ? new Date(summary.date) : null,
            startTime: summary.startTime,
            finishTime: summary.finishTime,
            task: summary.task,
            notes: summary.notes,
            weather: summary.weather,
            location: summary.location,
            confidence: summary.confidence,
            extractedSiReference: summary.siReferenceOnSheet,
            matchStatus: match.matchStatus,
            matchedVariationItemId: match.matchedVariationItemId,
            matchReason: match.matchReason
          }
        });
      }
      anySucceeded = true;
    } catch (error) {
      if (error instanceof AiSpendCapExceededError) {
        errors.push(error.message);
        break;
      }
      // UnreadablePdfError means the file itself genuinely couldn't be
      // rendered — worded accordingly. Anything else already survived
      // withTransientRetries' retries and still failed, so it's worded as
      // likely transient (a real, if less common, possibility) rather than
      // implying a permanent problem with the document — Retry (which only
      // re-attempts attachments that never produced a sheet row) is
      // genuinely likely to succeed for these.
      const message =
        error instanceof UnreadablePdfError
          ? `${attachment.fileName}: this document's pages couldn't be read automatically.`
          : `${attachment.fileName}: could not be read right now (likely a temporary issue) — try Retry.`;
      errors.push(message);
    }
  }

  await prisma.inboundDayWorksExtraction.update({
    where: { id: extractionId },
    data: {
      status: anySucceeded ? "ready_for_review" : "failed",
      extractionError: errors.length > 0 ? errors.join(" ") : null
    }
  });
}

// Only ever re-attempts attachments that genuinely never produced a sheet
// row (see runDayWorksExtraction's own "already processed" skip) — never
// duplicates an attachment that already succeeded.
export async function retryDayWorksExtraction(extractionId: string): Promise<void> {
  await prisma.inboundDayWorksExtraction.update({
    where: { id: extractionId },
    data: { status: "extracting", extractionError: null }
  });
  await runDayWorksExtraction(extractionId);
}

export type UpdateDayWorksExtractionSheetPatch = Partial<{
  sheetNumber: string | null;
  teamLeaderCount: number | null;
  teamMemberCount: number | null;
  totalHours: number | null;
  ratePerHour: number | null;
  date: string | null;
  startTime: string | null;
  finishTime: string | null;
  task: string | null;
  notes: string | null;
  weather: string | null;
  location: string | null;
  matchedVariationItemId: string | null;
  userAction: InboundDayWorksSheetAction;
  newItemReference: string | null;
  newItemTitle: string | null;
}>;

// Reviewer edits to a draft sheet — a confirmed (filed) sheet is immutable,
// same "never edit history once it's real" discipline as every other
// staged-review feature in this app.
export async function updateDayWorksExtractionSheet(sheetId: string, patch: UpdateDayWorksExtractionSheetPatch): Promise<void> {
  const sheet = await prisma.inboundDayWorksExtractionSheet.findUniqueOrThrow({ where: { id: sheetId } });
  if (sheet.filedAt) {
    throw new Error("This sheet has already been filed.");
  }

  await prisma.inboundDayWorksExtractionSheet.update({
    where: { id: sheetId },
    data: {
      ...patch,
      date: patch.date !== undefined ? (patch.date ? new Date(patch.date) : null) : undefined,
      // A manual pick is a confident human decision — reflect that in
      // matchStatus/matchReason rather than leaving a stale AI-proposed
      // status/reason attached to the reviewer's own override.
      matchStatus: patch.matchedVariationItemId !== undefined && patch.matchedVariationItemId != null ? "matched" : undefined,
      matchReason: patch.matchedVariationItemId !== undefined ? (patch.matchedVariationItemId != null ? "Manually selected" : null) : undefined
    }
  });
}

export function inferVariationType(reference: string): "variation" | "site_instruction" {
  return /^\s*SI[\s-]?\d/i.test(reference) ? "site_instruction" : "variation";
}

// Rows left `pending` fall back to a safe default — a clean deterministic
// match or a genuinely new record proceeds, but anything requiring
// judgement (likely_match/unresolved) defaults to a no-op unless the user
// explicitly acted on it. Same "never silently resolve a fuzzy or
// ambiguous match" rule as Payment Claim Import's own
// effectiveItemAction/effectiveVariationAction (lib/payment-claim-import.ts)
// — used at FILE time here too, not just for the review screen's display,
// so a reviewer who leaves an already-"matched" row untouched still gets
// it filed rather than silently skipped.
function effectiveSheetAction(sheet: {
  matchStatus: InboundDayWorksMatchStatus;
  userAction: InboundDayWorksSheetAction;
}): InboundDayWorksSheetAction {
  if (sheet.userAction !== "pending") return sheet.userAction;
  if (sheet.matchStatus === "matched") return "match_existing";
  if (sheet.matchStatus === "new") return "create_new";
  return "ignore";
}

export async function ignoreDayWorksExtractionSheets(extractionId: string, sheetIds: string[]): Promise<void> {
  await prisma.inboundDayWorksExtractionSheet.updateMany({
    where: { id: { in: sheetIds }, inboundDayWorksExtractionId: extractionId, filedAt: null },
    data: { userAction: "ignore" }
  });
  await recomputeExtractionStatus(extractionId);
}

async function recomputeExtractionStatus(extractionId: string): Promise<void> {
  const pendingCount = await prisma.inboundDayWorksExtractionSheet.count({
    where: { inboundDayWorksExtractionId: extractionId, userAction: "pending" }
  });
  if (pendingCount === 0) {
    await prisma.inboundDayWorksExtraction.update({
      where: { id: extractionId },
      data: { status: "completed", completedAt: new Date() }
    });
  }
}

// Every distinct VariationItem TYPE this batch would touch, so the API
// route can enforce module access precisely (project-level access to
// Variations/Site Instructions is never implied by whatever let the
// reviewer INTO the Incoming Emails queue in the first place).
export async function getRequiredModulesForFiling(
  extractionId: string,
  sheetIds: string[],
  convertToVariationItemIds: string[]
): Promise<("variations" | "site_instructions")[]> {
  const sheets = await prisma.inboundDayWorksExtractionSheet.findMany({
    where: { id: { in: sheetIds }, inboundDayWorksExtractionId: extractionId },
    select: { userAction: true, matchStatus: true, matchedVariationItemId: true, newItemReference: true }
  });

  const modules = new Set<"variations" | "site_instructions">();

  const matchedIds = sheets
    .filter((s) => effectiveSheetAction(s) === "match_existing" && s.matchedVariationItemId)
    .map((s) => s.matchedVariationItemId!);
  if (matchedIds.length > 0) {
    const matchedTypes = await prisma.variationItem.findMany({ where: { id: { in: matchedIds } }, select: { type: true } });
    for (const item of matchedTypes) modules.add(item.type === "variation" ? "variations" : "site_instructions");
  }
  for (const sheet of sheets) {
    if (effectiveSheetAction(sheet) === "create_new" && sheet.newItemReference) {
      modules.add(inferVariationType(sheet.newItemReference) === "variation" ? "variations" : "site_instructions");
    }
  }
  if (convertToVariationItemIds.length > 0) {
    modules.add("variations");
  }

  return Array.from(modules);
}

// The one transactional confirm step — files a subset of a batch (partial
// filing is supported: matched sheets now, unresolved ones left `pending`
// for a later pass). Copies each source attachment's bytes into a NEW S3
// object per (attachment, target item) group — the same non-destructive
// copy pattern the existing "Use as Day Works Sheet" action already uses —
// then creates one DayWorksSheet per group and one DayWorksSheetRecord per
// sheet in it. Known, accepted V1 simplification: filing the same
// attachment against the same target across two SEPARATE calls to this
// function creates a second DayWorksSheet copy of that file rather than
// reusing the first — functionally correct (every record lands against the
// right item) but the source file can appear more than once under that
// item's own Day Works Sheets list.
export async function fileDayWorksExtractionSheets(params: {
  extractionId: string;
  sheetIds: string[];
  reviewerUserId: string;
  convertToVariationItemIds: string[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const sheets = await prisma.inboundDayWorksExtractionSheet.findMany({
    where: { id: { in: params.sheetIds }, inboundDayWorksExtractionId: params.extractionId, filedAt: null },
    include: { inboundEmailAttachment: true }
  });
  if (sheets.length === 0) {
    return { ok: false, error: "No sheets to file." };
  }

  const toFile = sheets.filter((sheet) => {
    const action = effectiveSheetAction(sheet);
    return action === "match_existing" || action === "create_new";
  });
  for (const sheet of toFile) {
    const action = effectiveSheetAction(sheet);
    if (action === "create_new" && (!sheet.newItemReference?.trim() || !sheet.newItemTitle?.trim())) {
      return { ok: false, error: `Sheet ${sheet.sheetNumber ?? sheet.id} needs a reference and title before it can be filed as a new record.` };
    }
    if (action === "match_existing" && !sheet.matchedVariationItemId) {
      return { ok: false, error: `Sheet ${sheet.sheetNumber ?? sheet.id} needs a matched record selected before it can be filed.` };
    }
  }
  if (toFile.length === 0) {
    return { ok: false, error: "None of the selected sheets resolve to a match_existing or create_new action." };
  }

  await prisma.$transaction(async (tx) => {
    const extraction = await tx.inboundDayWorksExtraction.findUniqueOrThrow({ where: { id: params.extractionId } });

    // Resolve create_new sheets to a real VariationItem first — one per
    // distinct (normalized) newItemReference, so several sheets naming the
    // SAME new reference share one record rather than creating duplicates.
    const newItemIdByReference = new Map<string, string>();
    for (const sheet of toFile) {
      if (effectiveSheetAction(sheet) !== "create_new" || !sheet.newItemReference) continue;
      const key = normalizeReference(sheet.newItemReference);
      if (newItemIdByReference.has(key)) continue;
      const created = await tx.variationItem.create({
        data: {
          projectId: extraction.projectId,
          type: inferVariationType(sheet.newItemReference),
          reference: sheet.newItemReference,
          title: sheet.newItemTitle!
        }
      });
      newItemIdByReference.set(key, created.id);
    }

    const resolvedTargetId = (sheet: (typeof toFile)[number]): string =>
      effectiveSheetAction(sheet) === "create_new"
        ? newItemIdByReference.get(normalizeReference(sheet.newItemReference!))!
        : sheet.matchedVariationItemId!;

    // Group by (attachment, target) — a physical file can contain sheets
    // for different targets, and different files can target the same item;
    // each (attachment, target) pair gets its own S3 copy + DayWorksSheet.
    const groups = new Map<string, { attachmentId: string; targetId: string; sheets: typeof toFile }>();
    for (const sheet of toFile) {
      const targetId = resolvedTargetId(sheet);
      const key = `${sheet.inboundEmailAttachmentId}::${targetId}`;
      const existing = groups.get(key);
      if (existing) {
        existing.sheets.push(sheet);
      } else {
        groups.set(key, { attachmentId: sheet.inboundEmailAttachmentId, targetId, sheets: [sheet] });
      }
    }

    for (const group of groups.values()) {
      const attachment = group.sheets[0].inboundEmailAttachment;
      const buffer = await downloadFromS3(attachment.storageKey);
      const uploadKey = `projects/day-works-extractions/${params.extractionId}/${Date.now()}-${attachment.fileName}`;
      const { storageKey } = await uploadToS3({ key: uploadKey, body: buffer, contentType: attachment.contentType });

      const dayWorksSheet = await tx.dayWorksSheet.create({
        data: {
          variationItemId: group.targetId,
          fileName: attachment.fileName,
          storageKey,
          contentType: attachment.contentType
        }
      });

      for (const sheet of group.sheets) {
        const record = await tx.dayWorksSheetRecord.create({
          data: {
            variationItemId: group.targetId,
            dayWorksSheetId: dayWorksSheet.id,
            sheetNumber: sheet.sheetNumber?.trim() || `Sheet ${sheet.sheetIndexInAttachment + 1}`,
            teamLeaderCount: sheet.teamLeaderCount ?? 0,
            teamMemberCount: sheet.teamMemberCount ?? 0,
            totalHours: sheet.totalHours,
            ratePerHour: sheet.ratePerHour,
            date: sheet.date,
            startTime: sheet.startTime,
            finishTime: sheet.finishTime,
            task: sheet.task,
            notes: sheet.notes,
            weather: sheet.weather,
            location: sheet.location,
            sortOrder: sheet.sheetIndexInAttachment
          }
        });

        await tx.inboundDayWorksExtractionSheet.update({
          where: { id: sheet.id },
          data: {
            // Write back the RESOLVED action (never leave a filed row
            // reading "pending") — both for an accurate audit trail and so
            // recomputeExtractionStatus's own "any sheets still pending"
            // check is correct once every sheet has actually been dealt
            // with, one way or another.
            userAction: effectiveSheetAction(sheet),
            filedDayWorksSheetRecordId: record.id,
            filedAt: new Date(),
            filedByUserId: params.reviewerUserId
          }
        });
      }
    }

    for (const itemId of params.convertToVariationItemIds) {
      const item = await tx.variationItem.findUnique({ where: { id: itemId }, select: { type: true, variationCreatedAt: true } });
      if (item?.type === "site_instruction" && item.variationCreatedAt == null) {
        await giveVariationIdentity(tx, extraction.projectId, itemId);
      }
    }
  });

  await recomputeExtractionStatus(params.extractionId);
  return { ok: true };
}
