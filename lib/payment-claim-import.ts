import crypto from "node:crypto";
import type {
  PaymentClaimImport,
  PaymentClaimImportItem,
  PaymentClaimImportVariation,
  PaymentClaimImportMatchStatus,
  PaymentClaimImportItemAction,
  PaymentClaimImportVariationAction
} from "@prisma/client";
import { prisma } from "./prisma";
import { normalizeReference, reactivateVariationItem } from "./variation-item-lifecycle";
import { recordLifecycleEvent } from "./record-lifecycle-log";
import { recomputeClaimTotal } from "./payment-claim";

// ============================================================
// Payment Claim Import — establishes a project's current commercial
// baseline from a payment claim generated OUTSIDE Subbie HQ. See
// PaymentClaimImport's own schema comment for the full design.
//
// This file owns: document-hash duplicate detection, the deterministic
// matching engine (contract items by description, variations by
// reference-then-description — never dangerous fuzzy merging), and the
// one transactional confirm step that turns a reviewed draft into real
// ContractItem/VariationItem/PaymentClaim rows. Nothing here invents a
// second commercial data model — every canonical write goes through the
// exact same tables and helpers the rest of the app already uses
// (buildContractItemCreateData-equivalent nested creates, recomputeClaimTotal,
// reactivateVariationItem, recordLifecycleEvent).
// ============================================================

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeDocumentHash(buffer: Uint8Array): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

// A confirmed import with the same document hash in the same project is
// treated as an already-imported duplicate (Section 33) — checked BEFORE
// spending an AI call on extraction. A draft (never confirmed, e.g.
// abandoned mid-review) with the same hash does not block a fresh upload;
// only a CONFIRMED baseline is a real duplicate worth stopping for.
export async function findConfirmedDuplicateImport(projectId: string, documentHash: string) {
  return prisma.paymentClaimImport.findFirst({
    where: { projectId, documentHash, status: "confirmed" },
    orderBy: { confirmedAt: "desc" }
  });
}

// ------------------------------------------------------------------
// Matching engine (Section 12/30) — deterministic, always with a stated
// reason, never a silent merge. A tolerance mirrors
// lib/payment-reconciliation.ts's own $1 "sensible small rounding
// tolerance" convention for comparing two independently-derived $ figures.
// ------------------------------------------------------------------

const VALUE_CONFLICT_TOLERANCE = 1;
// Exported — lib/inbound-day-works.ts reuses this exact threshold so "is
// this a likely match" means the same thing in both places.
export const DESCRIPTION_SIMILARITY_THRESHOLD = 0.6;

function normalizeDescription(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

// Plain word-overlap (Jaccard on token sets) — deliberately simple and
// explainable, not a fuzzy-matching library. Section 12/30 are explicit
// that "dangerous fuzzy matching" must never silently merge unrelated
// records, so this is used only to PROPOSE a "likely_match" (always
// user-confirmable, never auto-applied like an exact/normalized match is).
// Exported for reuse — lib/inbound-day-works.ts's own matcher applies the
// exact same heuristic against a Day Works sheet's task text vs each
// VariationItem's title, so "how similar are two descriptions" only has one
// definition/threshold anywhere in this app.
export function descriptionSimilarity(a: string, b: string): number {
  const wordsA = new Set(normalizeDescription(a).split(" ").filter(Boolean));
  const wordsB = new Set(normalizeDescription(b).split(" ").filter(Boolean));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let intersection = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) intersection += 1;
  }
  const union = new Set([...wordsA, ...wordsB]).size;
  return union === 0 ? 0 : intersection / union;
}

function valuesConflict(extracted: number | null, existing: number | null): boolean {
  if (extracted == null || existing == null) return false;
  return Math.abs(extracted - existing) > VALUE_CONFLICT_TOLERANCE;
}

// ContractItem has no reference field of its own (a real quote's line
// items are identified by description, not a formal number) — so B2
// matching is description-only, unlike variations below which have a real
// `reference`.
function computeContractItemTotalValue(item: {
  components: { kind: string; amount: unknown; weeklyRate: unknown; quotedDurationWeeks: number | null }[];
}): number {
  let total = 0;
  for (const component of item.components) {
    if (component.kind === "weekly_hire") {
      total += Number(component.weeklyRate ?? 0) * (component.quotedDurationWeeks ?? 0);
    } else {
      total += Number(component.amount ?? 0);
    }
  }
  return round2(total);
}

export type ExtractedContractItemCandidate = {
  reference: string | null;
  description: string;
  contractValue: number | null;
  revisedValue: number | null;
  claimedPercentToDate: number | null;
  claimedAmountToDate: number | null;
  currentPeriodAmount: number | null;
  previousClaimedAmount: number | null;
};

type ItemMatchResult = {
  matchStatus: PaymentClaimImportMatchStatus;
  matchedContractItemId: string | null;
  matchReason: string | null;
  conflictNote: string | null;
};

type ExistingContractItemForMatching = {
  id: string;
  description: string;
  components: { kind: string; amount: unknown; weeklyRate: unknown; quotedDurationWeeks: number | null }[];
};

function finalizeItemMatch(
  item: ExistingContractItemForMatching,
  extracted: ExtractedContractItemCandidate,
  reason: string,
  baseStatus: "matched" | "likely_match"
): ItemMatchResult {
  const existingValue = computeContractItemTotalValue(item);
  if (valuesConflict(extracted.contractValue, existingValue)) {
    return {
      matchStatus: "conflict",
      matchedContractItemId: item.id,
      matchReason: reason,
      conflictNote: `Payment claim: $${extracted.contractValue}. Existing Subbie HQ record: $${existingValue}.`
    };
  }
  return { matchStatus: baseStatus, matchedContractItemId: item.id, matchReason: reason, conflictNote: null };
}

async function matchContractItem(projectId: string, extracted: ExtractedContractItemCandidate): Promise<ItemMatchResult> {
  const schedule = await prisma.contractSchedule.findUnique({
    where: { projectId },
    include: { items: { include: { components: true } } }
  });
  if (!schedule || schedule.items.length === 0) {
    return { matchStatus: "new", matchedContractItemId: null, matchReason: null, conflictNote: null };
  }

  const target = normalizeDescription(extracted.description);
  const exact = schedule.items.filter((item) => normalizeDescription(item.description) === target);
  if (exact.length === 1) {
    return finalizeItemMatch(exact[0], extracted, "Exact description match", "matched");
  }
  if (exact.length > 1) {
    return {
      matchStatus: "unresolved",
      matchedContractItemId: null,
      matchReason: "Multiple existing items share this exact description — please select the correct one.",
      conflictNote: null
    };
  }

  const scored = schedule.items
    .map((item) => ({ item, score: descriptionSimilarity(item.description, extracted.description) }))
    .filter((s) => s.score >= DESCRIPTION_SIMILARITY_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 1) {
    return finalizeItemMatch(scored[0].item, extracted, "Likely match based on description similarity", "likely_match");
  }
  if (scored.length > 1) {
    return {
      matchStatus: "unresolved",
      matchedContractItemId: null,
      matchReason: "Multiple possible matches found — please select the correct record.",
      conflictNote: null
    };
  }

  return { matchStatus: "new", matchedContractItemId: null, matchReason: null, conflictNote: null };
}

export type ExtractedVariationCandidate = {
  reference: string | null;
  description: string;
  submittedValue: number | null;
  approvedValue: number | null;
  claimedPercentToDate: number | null;
  claimedAmountToDate: number | null;
  currentPeriodAmount: number | null;
  approvalStatus: string | null;
};

type VariationMatchResult = {
  matchStatus: PaymentClaimImportMatchStatus;
  matchedVariationItemId: string | null;
  matchReason: string | null;
  conflictNote: string | null;
  existingRecordClosed: boolean;
};

type ExistingVariationForMatching = { id: string; reference: string; title: string; variationValue: unknown; closedAt: Date | null };

function finalizeVariationMatch(
  candidate: ExistingVariationForMatching,
  extracted: ExtractedVariationCandidate,
  reason: string,
  baseStatus: "matched" | "likely_match"
): VariationMatchResult {
  const existingValue = candidate.variationValue != null ? Number(candidate.variationValue) : null;
  const extractedValue = extracted.approvedValue ?? extracted.submittedValue;
  const closed = candidate.closedAt != null;

  if (valuesConflict(extractedValue, existingValue)) {
    return {
      matchStatus: "conflict",
      matchedVariationItemId: candidate.id,
      matchReason: reason,
      conflictNote: `Payment claim: $${extractedValue}. Existing Subbie HQ record: $${existingValue}.`,
      existingRecordClosed: closed
    };
  }
  return { matchStatus: baseStatus, matchedVariationItemId: candidate.id, matchReason: reason, conflictNote: null, existingRecordClosed: closed };
}

// Reference-first (reusing lib/variation-item-lifecycle.ts's own
// normalizeReference — the SAME normalisation already used by the SI
// closed-record resolver, so "SI-241"/"SI 241"/"SI241" behave identically
// here), across BOTH VariationItem types (a payment claim's B3 line can be
// either) — falling back to description similarity only when no reference
// match exists at all.
async function matchVariation(projectId: string, extracted: ExtractedVariationCandidate): Promise<VariationMatchResult> {
  const candidates = await prisma.variationItem.findMany({
    where: { projectId },
    select: { id: true, reference: true, title: true, variationValue: true, closedAt: true }
  });

  if (extracted.reference) {
    const target = normalizeReference(extracted.reference);
    const exact = candidates.filter((c) => normalizeReference(c.reference) === target);
    if (exact.length === 1) {
      const rawMatches = exact[0].reference.trim().toUpperCase() === extracted.reference.trim().toUpperCase();
      const reason = rawMatches
        ? `Exact reference match: ${extracted.reference}`
        : `Normalized reference match: ${extracted.reference} → ${exact[0].reference}`;
      return finalizeVariationMatch(exact[0], extracted, reason, "matched");
    }
    if (exact.length > 1) {
      return {
        matchStatus: "unresolved",
        matchedVariationItemId: null,
        matchReason: "Multiple existing records share this reference — please select the correct one.",
        conflictNote: null,
        existingRecordClosed: false
      };
    }
    // A reference WAS printed on the claim and simply doesn't match
    // anything — trust the reference number over a loose description
    // guess (a real subcontractor's SI/variation numbering is deliberate,
    // so a distinct number is itself strong evidence this is genuinely
    // new). The description-similarity fallback below is reserved for the
    // case where the document gave no reference to go on at all.
    return { matchStatus: "new", matchedVariationItemId: null, matchReason: null, conflictNote: null, existingRecordClosed: false };
  }

  const scored = candidates
    .map((candidate) => ({ candidate, score: descriptionSimilarity(candidate.title, extracted.description) }))
    .filter((s) => s.score >= DESCRIPTION_SIMILARITY_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 1) {
    return finalizeVariationMatch(scored[0].candidate, extracted, "Likely match based on description similarity", "likely_match");
  }
  if (scored.length > 1) {
    return {
      matchStatus: "unresolved",
      matchedVariationItemId: null,
      matchReason: "Multiple possible matches found — please select the correct record.",
      conflictNote: null,
      existingRecordClosed: false
    };
  }

  return { matchStatus: "new", matchedVariationItemId: null, matchReason: null, conflictNote: null, existingRecordClosed: false };
}

// ------------------------------------------------------------------
// Draft creation
// ------------------------------------------------------------------

const IMPORT_INCLUDE = {
  items: { orderBy: { id: "asc" as const } },
  variations: { orderBy: { id: "asc" as const } }
};

export type PaymentClaimImportWithLines = PaymentClaimImport & {
  items: PaymentClaimImportItem[];
  variations: PaymentClaimImportVariation[];
};

export type ExtractedPaymentClaimBaseline = {
  claimReference: string | null;
  claimDate: Date | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  projectNameOnDocument: string | null;
  projectReferenceOnDocument: string | null;
  contractReferenceOnDocument: string | null;
  originalContractSum: number | null;
  approvedVariationsTotal: number | null;
  revisedContractSum: number | null;
  pendingVariationsTotal: number | null;
  grossClaimToDate: number | null;
  retentionPercent: number | null;
  retentionToDate: number | null;
  netClaimToDate: number | null;
  previousClaims: number | null;
  currentClaim: number | null;
  contractItems: ExtractedContractItemCandidate[];
  variations: ExtractedVariationCandidate[];
  confidence: number;
  notes: string | null;
  arithmeticWarning: string | null;
};

export async function createDraftPaymentClaimImport(params: {
  projectId: string;
  userId: string;
  fileName: string;
  storageKey: string;
  contentType: string;
  documentHash: string;
  extracted: ExtractedPaymentClaimBaseline;
}): Promise<PaymentClaimImportWithLines> {
  const [itemMatches, variationMatches] = await Promise.all([
    Promise.all(params.extracted.contractItems.map((item) => matchContractItem(params.projectId, item))),
    Promise.all(params.extracted.variations.map((v) => matchVariation(params.projectId, v)))
  ]);

  // Section 16 — prefer the claim period end, then the claim date.
  const baselineDate = params.extracted.periodEnd ?? params.extracted.claimDate ?? null;

  const created = await prisma.paymentClaimImport.create({
    data: {
      projectId: params.projectId,
      status: "draft",
      fileName: params.fileName,
      storageKey: params.storageKey,
      contentType: params.contentType,
      documentHash: params.documentHash,
      aiConfidence: params.extracted.confidence,
      aiNotes: params.extracted.notes,
      extractedAt: new Date(),
      externalClaimReference: params.extracted.claimReference,
      claimDate: params.extracted.claimDate,
      periodStart: params.extracted.periodStart,
      periodEnd: params.extracted.periodEnd,
      projectNameOnDocument: params.extracted.projectNameOnDocument,
      projectReferenceOnDocument: params.extracted.projectReferenceOnDocument,
      contractReferenceOnDocument: params.extracted.contractReferenceOnDocument,
      originalContractSum: params.extracted.originalContractSum,
      approvedVariationsTotal: params.extracted.approvedVariationsTotal,
      revisedContractSum: params.extracted.revisedContractSum,
      pendingVariationsTotal: params.extracted.pendingVariationsTotal,
      grossClaimToDate: params.extracted.grossClaimToDate,
      retentionPercentStated: params.extracted.retentionPercent,
      retentionToDateStated: params.extracted.retentionToDate,
      netClaimToDate: params.extracted.netClaimToDate,
      previousClaimsTotal: params.extracted.previousClaims,
      currentClaimAmount: params.extracted.currentClaim,
      baselineDate,
      arithmeticWarning: params.extracted.arithmeticWarning,
      createdByUserId: params.userId,
      items: {
        create: params.extracted.contractItems.map((item, index) => ({
          reference: item.reference,
          description: item.description,
          contractValue: item.contractValue,
          revisedValue: item.revisedValue,
          claimedPercentToDate: item.claimedPercentToDate,
          claimedAmountToDate: item.claimedAmountToDate,
          currentPeriodAmount: item.currentPeriodAmount,
          previousClaimedAmount: item.previousClaimedAmount,
          matchStatus: itemMatches[index].matchStatus,
          matchedContractItemId: itemMatches[index].matchedContractItemId,
          matchReason: itemMatches[index].matchReason,
          conflictNote: itemMatches[index].conflictNote
        }))
      },
      variations: {
        create: params.extracted.variations.map((v, index) => ({
          reference: v.reference,
          description: v.description,
          submittedValue: v.submittedValue,
          approvedValue: v.approvedValue,
          claimedPercentToDate: v.claimedPercentToDate,
          claimedAmountToDate: v.claimedAmountToDate,
          currentPeriodAmount: v.currentPeriodAmount,
          approvalStatusRaw: v.approvalStatus,
          matchStatus: variationMatches[index].matchStatus,
          matchedVariationItemId: variationMatches[index].matchedVariationItemId,
          matchReason: variationMatches[index].matchReason,
          conflictNote: variationMatches[index].conflictNote,
          existingRecordClosed: variationMatches[index].existingRecordClosed
        }))
      }
    },
    include: IMPORT_INCLUDE
  });

  await recordLifecycleEvent({
    entityType: "payment_claim_import",
    entityId: created.id,
    eventType: "milestone",
    userId: params.userId,
    newState: "draft_created",
    note: `Extracted ${params.extracted.contractItems.length} contract item(s) and ${params.extracted.variations.length} variation(s) from ${params.fileName}.`
  });

  return created;
}

export async function getPaymentClaimImport(id: string): Promise<PaymentClaimImportWithLines | null> {
  return prisma.paymentClaimImport.findUnique({ where: { id }, include: IMPORT_INCLUDE });
}

export async function getPaymentClaimImportsForProject(projectId: string): Promise<PaymentClaimImportWithLines[]> {
  return prisma.paymentClaimImport.findMany({ where: { projectId }, orderBy: { createdAt: "desc" }, include: IMPORT_INCLUDE });
}

// ------------------------------------------------------------------
// User overrides (Section 31) — the review screen calling back in with an
// explicit decision on one row. Only ever allowed while the parent import
// is still `draft`.
// ------------------------------------------------------------------

export async function setImportItemAction(params: {
  itemId: string;
  userAction: PaymentClaimImportItemAction;
  matchedContractItemId?: string | null;
}): Promise<void> {
  const item = await prisma.paymentClaimImportItem.findUniqueOrThrow({
    where: { id: params.itemId },
    include: { paymentClaimImport: { select: { status: true } } }
  });
  if (item.paymentClaimImport.status !== "draft") {
    throw new Error("This import has already been confirmed or rejected.");
  }

  await prisma.paymentClaimImportItem.update({
    where: { id: params.itemId },
    data: {
      userAction: params.userAction,
      ...(params.matchedContractItemId !== undefined ? { matchedContractItemId: params.matchedContractItemId } : {})
    }
  });
}

export async function setImportVariationAction(params: {
  variationId: string;
  userAction: PaymentClaimImportVariationAction;
  matchedVariationItemId?: string | null;
}): Promise<void> {
  const variation = await prisma.paymentClaimImportVariation.findUniqueOrThrow({
    where: { id: params.variationId },
    include: { paymentClaimImport: { select: { status: true } } }
  });
  if (variation.paymentClaimImport.status !== "draft") {
    throw new Error("This import has already been confirmed or rejected.");
  }

  await prisma.paymentClaimImportVariation.update({
    where: { id: params.variationId },
    data: {
      userAction: params.userAction,
      ...(params.matchedVariationItemId !== undefined ? { matchedVariationItemId: params.matchedVariationItemId } : {})
    }
  });
}

export async function rejectPaymentClaimImport(importId: string, userId: string): Promise<void> {
  const draft = await prisma.paymentClaimImport.findUniqueOrThrow({ where: { id: importId } });
  if (draft.status !== "draft") {
    throw new Error("This import has already been confirmed or rejected.");
  }
  await prisma.paymentClaimImport.update({ where: { id: importId }, data: { status: "rejected" } });
  await recordLifecycleEvent({
    entityType: "payment_claim_import",
    entityId: importId,
    eventType: "milestone",
    userId,
    previousState: "draft",
    newState: "rejected"
  });
}

// ------------------------------------------------------------------
// Confirm (Section 8/32) — the ONLY point canonical data changes. Rows
// left `pending` fall back to a safe default (effectiveItemAction/
// effectiveVariationAction below): a clean deterministic match or a
// genuinely new record proceeds automatically, but anything requiring
// judgement (a conflict, an ambiguous match, a closed record) defaults to
// a no-op unless the user explicitly acted on it — never silently
// resolved. Exported so the review screen can show "what will happen if
// you leave this as-is" before the user ever clicks Confirm & Import.
// ------------------------------------------------------------------

export function effectiveItemAction(item: {
  matchStatus: PaymentClaimImportMatchStatus;
  userAction: PaymentClaimImportItemAction;
}): PaymentClaimImportItemAction {
  if (item.userAction !== "pending") return item.userAction;
  if (item.matchStatus === "matched") return "accept_match";
  if (item.matchStatus === "new") return "create_new";
  return "ignore";
}

export function effectiveVariationAction(v: {
  matchStatus: PaymentClaimImportMatchStatus;
  userAction: PaymentClaimImportVariationAction;
  existingRecordClosed: boolean;
}): PaymentClaimImportVariationAction {
  if (v.userAction !== "pending") return v.userAction;
  if (v.matchStatus === "matched" && !v.existingRecordClosed) return "match_existing";
  if (v.matchStatus === "new") return "create_new";
  return "ignore";
}

function inferVariationType(reference: string | null): "variation" | "site_instruction" {
  if (reference && /^\s*SI[\s-]?\d/i.test(reference)) return "site_instruction";
  return "variation";
}

function truncateTitle(text: string, max = 120): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

// Confirming establishes exactly ONE PaymentClaim (source: imported_external)
// representing the single uploaded snapshot — never a fabricated series of
// prior claims (Section 15/41). "Claimed to date" for the base contract
// works is established via ONE ContractItemProgressEntry per matched/created
// item, dated at the baseline (the SAME dated-checkpoint mechanism every
// other Contract Schedule progress figure already uses — see
// lib/contract-schedule.ts's resolvePhasePercent). "Claimed to date" for a
// variation is established via ONE VariationItemClaimAllocation on this
// new claim, holding the FULL cumulative claimed-to-date amount — since no
// other claim exists yet for that variation in Subbie HQ, that single
// allocation correctly IS the total, without inventing claim #01-#06.
//
// A contract item matched against an EXISTING ContractItem that has more
// than one component/phase is deliberately NOT auto-progressed — a single
// "% claimed to date" figure can't be safely split across an unknown
// number of phases without guessing an allocation the source document
// never stated. It's still linked (for provenance), just left for the
// user to progress manually on the Contract Schedule page afterward — a
// documented V1 limitation, not a silent gap.
export async function confirmPaymentClaimImport(
  importId: string,
  userId: string,
  options?: { baselineDate?: Date }
): Promise<{ paymentClaimId: string }> {
  const draft = await prisma.paymentClaimImport.findUnique({ where: { id: importId }, include: IMPORT_INCLUDE });
  if (!draft) throw new Error("Import not found.");
  if (draft.status !== "draft") {
    throw new Error("This import has already been confirmed or rejected.");
  }
  // Section 16 — if the document itself stated neither a period end nor a
  // claim date, the review screen requires the user to confirm one before
  // Confirm & Import is even enabled; that value arrives here as
  // options.baselineDate rather than blocking the whole import.
  if (draft.baselineDate == null && draft.periodEnd == null && draft.claimDate == null && !options?.baselineDate) {
    throw new Error("A baseline date is required before this can be imported.");
  }

  const resolvedBaselineDate = draft.baselineDate ?? options?.baselineDate ?? null;
  const resolvedPeriodEnd = draft.periodEnd ?? resolvedBaselineDate ?? draft.claimDate ?? new Date();
  const resolvedPeriodStart = draft.periodStart ?? resolvedPeriodEnd;
  const progressDate = resolvedBaselineDate ?? resolvedPeriodEnd;

  const paymentClaimId = await prisma.$transaction(
    async (tx) => {
      const latestClaim = await tx.paymentClaim.findFirst({
        where: { projectId: draft.projectId },
        orderBy: { claimNumber: "desc" }
      });

      let scheduleId: string | null = null;
      const existingSchedule = await tx.contractSchedule.findUnique({ where: { projectId: draft.projectId } });
      if (existingSchedule) scheduleId = existingSchedule.id;

      let contractWorksAmount = 0;
      let nextSortOrder = existingSchedule
        ? await tx.contractItem.count({ where: { scheduleId: existingSchedule.id } })
        : 0;

      for (const item of draft.items) {
        const action = effectiveItemAction(item);
        let matchedContractItemId = item.matchedContractItemId;

        if (action === "create_new") {
          if (!scheduleId) {
            const schedule = await tx.contractSchedule.create({ data: { projectId: draft.projectId, status: "confirmed" } });
            scheduleId = schedule.id;
          }
          const createdItem = await tx.contractItem.create({
            data: {
              scheduleId,
              description: item.description,
              sortOrder: nextSortOrder++,
              components: {
                create: [
                  {
                    kind: "fixed",
                    label: "Imported",
                    sortOrder: 0,
                    amount: item.contractValue ?? item.revisedValue ?? 0,
                    phases: { create: [{ label: "Complete", sharePercent: 100, sortOrder: 0 }] }
                  }
                ]
              }
            },
            include: { components: { include: { phases: true } } }
          });
          matchedContractItemId = createdItem.id;

          if (item.claimedPercentToDate != null) {
            await tx.contractItemProgressEntry.create({
              data: {
                phaseId: createdItem.components[0].phases[0].id,
                effectiveDate: progressDate,
                percent: item.claimedPercentToDate,
                source: "manual",
                note: "Imported from Payment Claim",
                createdByUserId: userId
              }
            });
          }
        } else if (action === "accept_match" && matchedContractItemId) {
          const matched = await tx.contractItem.findUnique({
            where: { id: matchedContractItemId },
            include: { components: { include: { phases: true } } }
          });
          if (matched && matched.components.length === 1 && matched.components[0].phases.length === 1 && item.claimedPercentToDate != null) {
            await tx.contractItemProgressEntry.create({
              data: {
                phaseId: matched.components[0].phases[0].id,
                effectiveDate: progressDate,
                percent: item.claimedPercentToDate,
                source: "manual",
                note: "Imported from Payment Claim",
                createdByUserId: userId
              }
            });
          }
          // Multi-component/phase match: linked for provenance only — see
          // this function's own comment above on why progress isn't guessed.
        }

        if (action !== "ignore" && item.claimedAmountToDate != null) {
          contractWorksAmount += Number(item.claimedAmountToDate);
        }

        await tx.paymentClaimImportItem.update({
          where: { id: item.id },
          data: { userAction: action, matchedContractItemId }
        });
      }

      const claim = await tx.paymentClaim.create({
        data: {
          projectId: draft.projectId,
          claimNumber: (latestClaim?.claimNumber ?? 0) + 1,
          referenceDate: draft.claimDate ?? resolvedPeriodEnd,
          periodStart: resolvedPeriodStart,
          periodEnd: resolvedPeriodEnd,
          status: "issued",
          source: "imported_external",
          externalReference: draft.externalClaimReference,
          statutoryWording: "This is a payment claim made under the Construction Contracts Act 2002.",
          claimMonth: `${resolvedPeriodEnd.getUTCFullYear()}-${String(resolvedPeriodEnd.getUTCMonth() + 1).padStart(2, "0")}`,
          contractWorksAmount: round2(contractWorksAmount),
          storageKey: draft.storageKey
        }
      });

      for (const variation of draft.variations) {
        const action = effectiveVariationAction(variation);
        if (action === "ignore") {
          await tx.paymentClaimImportVariation.update({ where: { id: variation.id }, data: { userAction: action } });
          continue;
        }

        let variationItemId = variation.matchedVariationItemId;
        const newValue = variation.approvedValue ?? variation.submittedValue ?? null;

        if (action === "create_new") {
          const created = await tx.variationItem.create({
            data: {
              projectId: draft.projectId,
              type: inferVariationType(variation.reference),
              reference: variation.reference ?? `IMPORT-${variation.id.slice(-6)}`,
              title: truncateTitle(variation.description),
              description: variation.description,
              variationCreatedAt: progressDate,
              variationValue: newValue
            }
          });
          variationItemId = created.id;
        } else if (action === "reactivate_and_update" && variationItemId) {
          await reactivateVariationItem({ variationItemId, userId, note: "Reactivated via Payment Claim Import" });
          if (newValue != null) {
            await tx.variationItem.update({ where: { id: variationItemId }, data: { variationValue: newValue } });
          }
        } else if (action === "update_existing" && variationItemId) {
          if (newValue != null) {
            await tx.variationItem.update({ where: { id: variationItemId }, data: { variationValue: newValue } });
          }
        }
        // match_existing: link only, no field changes.

        if (variationItemId && variation.claimedAmountToDate != null) {
          await tx.variationItemClaimAllocation.create({
            data: {
              variationItemId,
              paymentClaimId: claim.id,
              amount: variation.claimedAmountToDate,
              createdByUserId: userId
            }
          });
        }

        await tx.paymentClaimImportVariation.update({
          where: { id: variation.id },
          data: { userAction: action, matchedVariationItemId: variationItemId }
        });
      }

      await tx.paymentClaimImport.update({
        where: { id: importId },
        data: { status: "confirmed", confirmedAt: new Date(), confirmedByUserId: userId, resultingPaymentClaimId: claim.id }
      });

      return claim.id;
    },
    { timeout: 20000 }
  );

  // Outside the transaction, same convention as every other allocation
  // write in this app (lib/payment-claim.ts's setVariationAllocation) —
  // claimedAmount is always DERIVED, never hand-set, from
  // contractWorksAmount + otherAmount + allocations.
  await recomputeClaimTotal(paymentClaimId);

  await recordLifecycleEvent({
    entityType: "payment_claim_import",
    entityId: importId,
    eventType: "milestone",
    userId,
    previousState: "draft",
    newState: "confirmed",
    note: `Established commercial baseline as at ${progressDate.toISOString().slice(0, 10)}.`
  });

  return { paymentClaimId };
}
