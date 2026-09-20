import type { ContractorPaymentSchedule, PaymentReconciliationAdjustment, PaymentReconciliationDeclineLine } from "@prisma/client";
import { prisma } from "./prisma";

// ============================================================
// Payment Reconciliation — see ContractorPaymentSchedule's own schema
// comment for the full design. This file owns every calculation and
// mutation for that model and its two child models; nothing outside this
// file should compute a decline total, an outstanding figure, or decide
// what the "current" reconciliation position is — see
// getLatestConfirmedReconciliation below.
//
// The operating principle this whole file protects: Claimed, Certified and
// Received are three independent facts. None is ever derived from another.
// A null receivedAmount means genuinely unknown, never $0 — every function
// here that touches receivedAmount/outstanding preserves that distinction
// explicitly rather than coercing null to 0 anywhere.
// ============================================================

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// A sensible small rounding tolerance for the claimed ≈ certified +
// declined check (Section 10.1) — $1, not cents-level, since claimed and
// certified are independently stated by two different parties (or read by
// AI vision extraction) and small, legitimate rounding differences are
// normal. Reused identically by the AI self-verification step
// (lib/grok.ts's extractPaymentScheduleFromImages) and the review UI's
// live discrepancy warning, so "does this reconcile" only has one
// definition anywhere in this feature.
const RECONCILIATION_TOLERANCE = 1;

export type DeclineLineInput = { description: string; amount: number; reason: string; variationItemId?: string | null };
export type AdjustmentInput = { description: string; amount: number };

// A payment date with no recorded amount would silently imply a payment
// happened when it hasn't (Section 11.7 of the spec this implements) — so
// a received date is only ever kept alongside a real, non-null
// receivedAmount, at every write path (manual entry, draft extraction,
// draft edit), never left to each caller to remember.
function resolvePaymentReceivedDate(receivedAmount: number | null, paymentReceivedDate: Date | null): Date | null {
  return receivedAmount == null ? null : paymentReceivedDate;
}

// The authoritative declined total is always the sum of the child lines —
// never an independently editable parent value that could disagree with
// them (Section 11.3 of the spec this implements).
export function computeDeclinedAmountFromLines(lines: { amount: number }[]): number {
  return round2(lines.reduce((sum, line) => sum + line.amount, 0));
}

export type ReconciliationCheck = { reconciles: boolean; difference: number };

// The only deterministic arithmetic this feature enforces: claimed ≈
// certified + declined. Returns the discrepancy for the reviewer to see —
// never used to silently "fix" a number, redistribute a difference, or
// block a save. null claimedAmount/certifiedAmount (an incomplete draft)
// means there isn't enough information to check yet, not a $0 vs $0 match.
export function checkClaimReconciliation(
  claimedAmount: number | null,
  certifiedAmount: number | null,
  declinedAmount: number
): ReconciliationCheck | null {
  if (claimedAmount == null || certifiedAmount == null) return null;
  const difference = round2(claimedAmount - (certifiedAmount + declinedAmount));
  return { reconciles: Math.abs(difference) <= RECONCILIATION_TOLERANCE, difference };
}

// outstanding is only ever computed when receivedAmount is known.
// certifiedAmount == null (nothing confirmed yet) or receivedAmount ==
// null (received genuinely not recorded) both mean "unknown," never a
// computed $0 or a bare certifiedAmount treated as fully outstanding by
// accident.
export function computeOutstanding(certifiedAmount: number | null, receivedAmount: number | null): number | null {
  if (certifiedAmount == null || receivedAmount == null) return null;
  return round2(certifiedAmount - receivedAmount);
}

const RECONCILIATION_INCLUDE = {
  declineLines: { orderBy: { id: "asc" as const } },
  adjustments: { orderBy: { createdAt: "asc" as const } }
};

export type ContractorPaymentScheduleWithLines = ContractorPaymentSchedule & {
  declineLines: PaymentReconciliationDeclineLine[];
  adjustments: PaymentReconciliationAdjustment[];
};

// The one place "what's the current confirmed position for this claim" is
// defined — every caller (the claim detail page, Task 4's carry-forward
// panel, Task 5's Portfolio Profitability rollup) uses this instead of its
// own `orderBy: createdAt desc` guess, so the definition of "current"
// can't drift between call sites.
export async function getLatestConfirmedReconciliation(paymentClaimId: string): Promise<ContractorPaymentScheduleWithLines | null> {
  return prisma.contractorPaymentSchedule.findFirst({
    where: { paymentClaimId, status: "confirmed" },
    orderBy: { createdAt: "desc" },
    include: RECONCILIATION_INCLUDE
  });
}

// Full history, newest first — confirmed and draft rows both, for the
// claim detail page's "Current position" vs "Historical responses"
// distinction (Section 22 of the spec). Never filters anything out:
// nothing is ever deleted or hidden here.
export async function getReconciliationHistory(paymentClaimId: string): Promise<ContractorPaymentScheduleWithLines[]> {
  return prisma.contractorPaymentSchedule.findMany({
    where: { paymentClaimId },
    orderBy: { createdAt: "desc" },
    include: RECONCILIATION_INCLUDE
  });
}

export async function getContractorPaymentSchedule(id: string): Promise<ContractorPaymentScheduleWithLines | null> {
  return prisma.contractorPaymentSchedule.findUnique({ where: { id }, include: RECONCILIATION_INCLUDE });
}

// Confirming the FIRST confirmed response against an `issued` claim is
// what finally gives ClaimStatus.responded a real meaning (Section 23) —
// checked by counting confirmed rows that existed before this one, not by
// assuming "this is claim's only response," since an amended/corrected
// response can be confirmed later against a claim that's already
// `responded`. A draft extraction never reaches this function at all.
async function markClaimRespondedIfFirstConfirmation(paymentClaimId: string, excludingScheduleId: string): Promise<void> {
  const priorConfirmedCount = await prisma.contractorPaymentSchedule.count({
    where: { paymentClaimId, status: "confirmed", id: { not: excludingScheduleId } }
  });
  if (priorConfirmedCount > 0) return;

  const claim = await prisma.paymentClaim.findUnique({ where: { id: paymentClaimId }, select: { status: true } });
  if (claim?.status === "issued") {
    await prisma.paymentClaim.update({ where: { id: paymentClaimId }, data: { status: "responded" } });
  }
}

export type CreateManualReconciliationParams = {
  paymentClaimId: string;
  userId: string;
  claimedAmount: number;
  certifiedAmount: number;
  declineLines: DeclineLineInput[];
  statedRetentionAmount: number | null;
  adjustments: AdjustmentInput[];
  receivedAmount: number | null;
  paymentDueDate: Date | null;
  paymentReceivedDate: Date | null;
};

// Manual entry goes straight to `confirmed` — the person typing the
// numbers in IS the review step (Section 12 of the spec), so a separate
// draft->confirm click here would be pure friction, unlike a document
// upload extraction (createDraftFromExtraction below).
export async function createManualReconciliation(
  params: CreateManualReconciliationParams
): Promise<ContractorPaymentScheduleWithLines> {
  const declinedAmount = computeDeclinedAmountFromLines(params.declineLines);
  const now = new Date();

  const schedule = await prisma.contractorPaymentSchedule.create({
    data: {
      paymentClaimId: params.paymentClaimId,
      source: "manual",
      status: "confirmed",
      claimedAmount: params.claimedAmount,
      certifiedAmount: params.certifiedAmount,
      declinedAmount,
      statedRetentionAmount: params.statedRetentionAmount,
      receivedAmount: params.receivedAmount,
      paymentDueDate: params.paymentDueDate,
      paymentReceivedDate: resolvePaymentReceivedDate(params.receivedAmount, params.paymentReceivedDate),
      confirmedAt: now,
      confirmedByUserId: params.userId,
      createdByUserId: params.userId,
      declineLines: {
        create: params.declineLines.map((line) => ({
          description: line.description,
          amount: line.amount,
          reason: line.reason,
          variationItemId: line.variationItemId ?? null
        }))
      },
      adjustments: {
        create: params.adjustments.map((adjustment) => ({
          description: adjustment.description,
          amount: adjustment.amount,
          createdByUserId: params.userId
        }))
      }
    },
    include: RECONCILIATION_INCLUDE
  });

  await markClaimRespondedIfFirstConfirmation(params.paymentClaimId, schedule.id);
  return schedule;
}

export type ExtractedReconciliationData = {
  claimedAmount: number | null;
  certifiedAmount: number | null;
  declineLines: DeclineLineInput[];
  statedRetentionAmount: number | null;
  adjustments: AdjustmentInput[];
  receivedAmount: number | null;
  paymentDueDate: Date | null;
  paymentReceivedDate: Date | null;
  confidence: number;
  notes: string | null;
};

// Persists the extraction result immediately as a draft row (Section 17 —
// deliberately unlike the Day Works flow, which never persists a draft at
// all). Never touches PaymentClaim.status: only an explicit confirmation
// does that (Section 23).
export async function createDraftReconciliationFromExtraction(params: {
  paymentClaimId: string;
  userId: string;
  extracted: ExtractedReconciliationData;
  fileName: string;
  storageKey: string;
  contentType: string;
}): Promise<ContractorPaymentScheduleWithLines> {
  const declinedAmount = computeDeclinedAmountFromLines(params.extracted.declineLines);

  return prisma.contractorPaymentSchedule.create({
    data: {
      paymentClaimId: params.paymentClaimId,
      source: "document_upload",
      status: "draft",
      claimedAmount: params.extracted.claimedAmount,
      certifiedAmount: params.extracted.certifiedAmount,
      declinedAmount,
      statedRetentionAmount: params.extracted.statedRetentionAmount,
      receivedAmount: params.extracted.receivedAmount,
      paymentDueDate: params.extracted.paymentDueDate,
      paymentReceivedDate: resolvePaymentReceivedDate(params.extracted.receivedAmount, params.extracted.paymentReceivedDate),
      aiConfidence: params.extracted.confidence,
      aiNotes: params.extracted.notes,
      extractedAt: new Date(),
      fileName: params.fileName,
      storageKey: params.storageKey,
      contentType: params.contentType,
      createdByUserId: params.userId,
      declineLines: {
        create: params.extracted.declineLines.map((line) => ({
          description: line.description,
          amount: line.amount,
          reason: line.reason,
          variationItemId: line.variationItemId ?? null
        }))
      },
      adjustments: {
        create: params.extracted.adjustments.map((adjustment) => ({
          description: adjustment.description,
          amount: adjustment.amount,
          createdByUserId: params.userId
        }))
      }
    },
    include: RECONCILIATION_INCLUDE
  });
}

export type UpdateDraftReconciliationParams = {
  claimedAmount: number | null;
  certifiedAmount: number | null;
  declineLines: DeclineLineInput[];
  statedRetentionAmount: number | null;
  adjustments: AdjustmentInput[];
  receivedAmount: number | null;
  paymentDueDate: Date | null;
  paymentReceivedDate: Date | null;
};

// Editing is only ever allowed on a draft — a confirmed row is immutable
// (Section 19/20 of the spec); the caller (the API route) is responsible
// for rejecting this against a confirmed row, but this function re-checks
// too rather than trusting the caller alone, since immutability of
// confirmed commercial records is the single most important invariant in
// this feature.
export async function updateDraftReconciliation(
  id: string,
  params: UpdateDraftReconciliationParams
): Promise<ContractorPaymentScheduleWithLines> {
  const existing = await prisma.contractorPaymentSchedule.findUniqueOrThrow({ where: { id } });
  if (existing.status !== "draft") {
    throw new Error("This response has already been confirmed and can no longer be edited.");
  }

  const declinedAmount = computeDeclinedAmountFromLines(params.declineLines);

  // Full delete+recreate of the child lines on every save, same convention
  // as the Day Works sheet-records review save — this is still an
  // editable draft, not a form with per-row identity worth preserving.
  await prisma.$transaction([
    prisma.paymentReconciliationDeclineLine.deleteMany({ where: { contractorPaymentScheduleId: id } }),
    prisma.paymentReconciliationAdjustment.deleteMany({ where: { contractorPaymentScheduleId: id } }),
    prisma.contractorPaymentSchedule.update({
      where: { id },
      data: {
        claimedAmount: params.claimedAmount,
        certifiedAmount: params.certifiedAmount,
        declinedAmount,
        statedRetentionAmount: params.statedRetentionAmount,
        receivedAmount: params.receivedAmount,
        paymentDueDate: params.paymentDueDate,
        paymentReceivedDate: resolvePaymentReceivedDate(params.receivedAmount, params.paymentReceivedDate),
        declineLines: {
          create: params.declineLines.map((line) => ({
            description: line.description,
            amount: line.amount,
            reason: line.reason,
            variationItemId: line.variationItemId ?? null
          }))
        },
        adjustments: {
          create: params.adjustments.map((adjustment) => ({
            description: adjustment.description,
            amount: adjustment.amount,
            createdByUserId: existing.createdByUserId
          }))
        }
      }
    })
  ]);

  return prisma.contractorPaymentSchedule.findUniqueOrThrow({ where: { id }, include: RECONCILIATION_INCLUDE });
}

// The only action that moves draft -> confirmed (Section 19). Requires
// claimedAmount and certifiedAmount to both be present — a confirmed
// commercial record can't represent "we don't actually know what was
// certified." This is an application-level rule, not a schema constraint
// (see ContractorPaymentSchedule's own comment on why both columns are
// nullable), so an incomplete draft is always saveable and reviewable, but
// never confirmable until it's complete enough to mean something.
export async function confirmReconciliation(id: string, userId: string): Promise<ContractorPaymentScheduleWithLines> {
  const existing = await prisma.contractorPaymentSchedule.findUniqueOrThrow({ where: { id } });
  if (existing.status === "confirmed") {
    return prisma.contractorPaymentSchedule.findUniqueOrThrow({ where: { id }, include: RECONCILIATION_INCLUDE });
  }
  if (existing.claimedAmount == null || existing.certifiedAmount == null) {
    throw new Error("Enter both the claimed and certified amounts before confirming.");
  }

  await prisma.contractorPaymentSchedule.update({
    where: { id },
    data: { status: "confirmed", confirmedAt: new Date(), confirmedByUserId: userId }
  });

  await markClaimRespondedIfFirstConfirmation(existing.paymentClaimId, id);
  return prisma.contractorPaymentSchedule.findUniqueOrThrow({ where: { id }, include: RECONCILIATION_INCLUDE });
}
