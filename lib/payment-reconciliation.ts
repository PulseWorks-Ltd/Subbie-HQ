import type { ContractorPaymentSchedule, PaymentReconciliationAdjustment, PaymentReconciliationDeclineLine } from "@prisma/client";
import { prisma } from "./prisma";
import { setVariationAllocation, recomputeClaimTotal } from "./payment-claim";

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

// ============================================================
// Task 4 — carrying/resolving a previous claim's declines forward. Once a
// decline is CONFIRMED (never a draft's), it either gets carried forward
// (re-claimed on a later, still-draft claim) or resolved some other way
// (credited, evidence provided, or otherwise). Every resolution is
// terminal and one-way — this file never reopens a resolved line, matching
// the immutability discipline the rest of this file already applies to a
// confirmed ContractorPaymentSchedule itself.
// ============================================================

export type OpenDeclineLine = PaymentReconciliationDeclineLine & { paymentClaimId: string; claimNumber: number };

// Every still-open decline line from any OTHER claim in the project,
// newest claim first — sourced only from each claim's LATEST CONFIRMED
// reconciliation (getLatestConfirmedReconciliation), so a decline that was
// superseded by a later, more favourable response on the SAME claim never
// resurfaces here as if it still needed resolving.
export async function getOpenDeclineLinesForProject(projectId: string, excludingClaimId: string): Promise<OpenDeclineLine[]> {
  const claims = await prisma.paymentClaim.findMany({
    where: { projectId, id: { not: excludingClaimId } },
    select: { id: true, claimNumber: true },
    orderBy: { claimNumber: "desc" }
  });

  const results: OpenDeclineLine[] = [];
  for (const claim of claims) {
    const latest = await getLatestConfirmedReconciliation(claim.id);
    if (!latest) continue;
    for (const line of latest.declineLines) {
      if (line.resolution === "open") {
        results.push({ ...line, paymentClaimId: claim.id, claimNumber: claim.claimNumber });
      }
    }
  }
  return results;
}

// Re-claims a previously-declined amount on a later claim — the only
// resolution with a real financial effect. Two paths, both reusing
// EXISTING mechanisms rather than inventing a new one:
//   - linked to a Variation/SI: adds to that item's own claim allocation
//     on the target claim (lib/payment-claim.ts's setVariationAllocation
//     — the same mechanism the Variations panel already uses), on top of
//     whatever's already allocated there, so calling this twice by
//     accident is additive, not a silent overwrite of unrelated work.
//   - not linked to any item (base contract work, or unidentifiable): adds
//     to the target claim's own free-text `otherAmount`/`otherDescription`
//     — the existing ad hoc catch-all line PaymentClaim already has for
//     exactly this shape of charge, rather than a new dedicated model for
//     what should be a rare case in practice.
// Only ever called against a DRAFT target claim (enforced by the caller,
// the API route) — carrying an amount into an already-issued claim would
// misrepresent what was actually submitted to the contractor.
export async function carryForwardDeclineLine(params: {
  declineLineId: string;
  targetClaimId: string;
  userId: string;
}): Promise<void> {
  const line = await prisma.paymentReconciliationDeclineLine.findUniqueOrThrow({ where: { id: params.declineLineId } });
  if (line.resolution !== "open") {
    throw new Error("This decline has already been resolved.");
  }

  if (line.variationItemId) {
    const existingAllocation = await prisma.variationItemClaimAllocation.findUnique({
      where: { variationItemId_paymentClaimId: { variationItemId: line.variationItemId, paymentClaimId: params.targetClaimId } }
    });
    const amount = round2((existingAllocation ? Number(existingAllocation.amount) : 0) + Number(line.amount));
    await setVariationAllocation({
      paymentClaimId: params.targetClaimId,
      variationItemId: line.variationItemId,
      amount,
      userId: params.userId
    });
  } else {
    const targetClaim = await prisma.paymentClaim.findUniqueOrThrow({ where: { id: params.targetClaimId } });
    const note = `Carried forward: ${line.description} (${line.reason})`;
    await prisma.paymentClaim.update({
      where: { id: params.targetClaimId },
      data: {
        otherAmount: round2(Number(targetClaim.otherAmount) + Number(line.amount)),
        otherDescription: targetClaim.otherDescription ? `${targetClaim.otherDescription}; ${note}` : note
      }
    });
    await recomputeClaimTotal(params.targetClaimId);
  }

  await prisma.paymentReconciliationDeclineLine.update({
    where: { id: params.declineLineId },
    data: {
      resolution: "carried_forward",
      resolvedInClaimId: params.targetClaimId,
      resolvedByUserId: params.userId,
      resolvedAt: new Date()
    }
  });
}

// The other three resolutions — none change any claim's figures, they're
// purely a record of how the subcontractor chose to deal with a decline
// without re-claiming it (accepted as a credit/write-off, evidence has
// since been provided so it's expected to be resolved on a future
// response without needing to re-claim it here, or some other outcome
// captured in the free-text note).
export async function resolveDeclineLineWithoutCarryForward(params: {
  declineLineId: string;
  resolution: "credited" | "evidence_provided" | "resolved_other";
  note: string | null;
  userId: string;
}): Promise<void> {
  const line = await prisma.paymentReconciliationDeclineLine.findUniqueOrThrow({ where: { id: params.declineLineId } });
  if (line.resolution !== "open") {
    throw new Error("This decline has already been resolved.");
  }

  await prisma.paymentReconciliationDeclineLine.update({
    where: { id: params.declineLineId },
    data: {
      resolution: params.resolution,
      resolutionNote: params.note,
      resolvedByUserId: params.userId,
      resolvedAt: new Date()
    }
  });
}

// ============================================================
// Task 5 — feeding Certified/Received into Portfolio Profitability
// (lib/project-profitability.ts). See that file's own header comment for
// the full Claimed -> Certified -> Received chain this completes.
// ============================================================

// The project-wide counterpart to getLatestConfirmedReconciliation — one
// query for every claim's confirmed rows, then the latest per claim kept
// in memory, rather than N+1 separate lookups (this feeds the Portfolio
// Profitability dashboard, so it needs to stay cheap across every active
// project, not just one claim at a time).
export async function getLatestConfirmedReconciliationsForProject(projectId: string): Promise<ContractorPaymentScheduleWithLines[]> {
  const claims = await prisma.paymentClaim.findMany({ where: { projectId }, select: { id: true } });
  if (claims.length === 0) return [];

  const confirmed = await prisma.contractorPaymentSchedule.findMany({
    where: { paymentClaimId: { in: claims.map((claim) => claim.id) }, status: "confirmed" },
    orderBy: { createdAt: "desc" },
    include: RECONCILIATION_INCLUDE
  });

  // confirmed is already newest-first, so the first row seen per claim is
  // its latest — same definition of "current" as getLatestConfirmedReconciliation.
  const latestByClaim = new Map<string, ContractorPaymentScheduleWithLines>();
  for (const schedule of confirmed) {
    if (!latestByClaim.has(schedule.paymentClaimId)) {
      latestByClaim.set(schedule.paymentClaimId, schedule);
    }
  }
  return Array.from(latestByClaim.values());
}

export type PaymentTrackingSummary = {
  // Sum of certifiedAmount across every claim's latest confirmed
  // response — real money the contractor has agreed to pay, always
  // calculable once a response exists (0 for a project with no confirmed
  // responses yet, which is a genuine $0, not an unknown one).
  certifiedToDate: number;
  // Sum of receivedAmount, counting ONLY claims where it's actually
  // known (non-null) — never treats an unrecorded receipt as $0.
  receivedToDate: number;
  // Sum of (certified - received), counting ONLY claims where BOTH are
  // known — this is genuine, confirmed outstanding money, not a guess.
  outstanding: number;
  // Sum of certifiedAmount for claims that ARE certified but whose
  // receivedAmount is still unrecorded — the honest "we don't yet know"
  // bucket this feature exists to keep separate from both receivedToDate
  // and outstanding. certifiedToDate always equals receivedToDate +
  // outstanding + awaitingReceiptConfirmation.
  awaitingReceiptConfirmation: number;
  // claimedToDate - certifiedToDate — money claimed that hasn't been
  // certified at all yet (no confirmed response, or the contractor
  // certified less than was claimed). Can go negative if a contractor's
  // stated certifiedAmount somehow exceeds Subbie HQ's own claimedToDate
  // (a genuine data discrepancy worth surfacing, never clamped away).
  uncertifiedToDate: number;
  trackingEnabled: true;
};

// The one place "what does Certified/Received look like across a set of
// claims" is computed — used identically by the per-project Profitability
// page and the cross-project Portfolio dashboard, so the two can never
// define these figures differently.
export function summarizePaymentTracking(
  claimedToDate: number,
  reconciliations: ContractorPaymentScheduleWithLines[]
): PaymentTrackingSummary {
  let certifiedToDate = 0;
  let receivedToDate = 0;
  let outstanding = 0;
  let awaitingReceiptConfirmation = 0;

  for (const schedule of reconciliations) {
    const certified = schedule.certifiedAmount != null ? Number(schedule.certifiedAmount) : null;
    if (certified == null) continue; // a confirmed row somehow missing certifiedAmount shouldn't happen (confirmReconciliation requires it), but never assume $0 if it does

    certifiedToDate += certified;
    const received = schedule.receivedAmount != null ? Number(schedule.receivedAmount) : null;
    if (received == null) {
      awaitingReceiptConfirmation += certified;
    } else {
      receivedToDate += received;
      outstanding += certified - received;
    }
  }

  return {
    certifiedToDate: round2(certifiedToDate),
    receivedToDate: round2(receivedToDate),
    outstanding: round2(outstanding),
    awaitingReceiptConfirmation: round2(awaitingReceiptConfirmation),
    uncertifiedToDate: round2(claimedToDate - certifiedToDate),
    trackingEnabled: true
  };
}
