import type { ClaimEvidenceType, RetentionReleaseTrigger, RetentionTimingUnit } from "@prisma/client";
import { prisma } from "./prisma";
import { recordLifecycleEvent } from "./record-lifecycle-log";
import { computeReleaseDate, endOfMonth } from "./retention-dates";

// ============================================================
// Retention tracking — the release side of Appendix B1's "Less retention"
// line. Total withheld is deliberately NEVER stored: PaymentClaim rows
// are already the real, live record of what's been claimed, so this
// always recomputes from them rather than keeping a second number that
// could drift out of sync. See the Retention model's own schema comment
// for the two-tranche design and the deliberately deferred retention-cap
// gap, and subbie-hq-retention-management-v2-plan.md for the full design
// behind everything in this file.
// ============================================================

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// The one figure every other calculation here builds on: retentionPercent
// (from ContractTerms) applied to every claim's own claimedAmount, summed.
// A missing retentionPercent means "not yet configured" — treated as 0
// rather than throwing, so this page still renders sensibly before
// Contract Terms has been filled in. Only non-draft claims count — a
// draft is a work-in-progress figure the subbie hasn't even issued yet,
// so counting its retention as genuinely "withheld by the Main
// Contractor" would overstate the real figure (Retention V2 plan §5/§13).
export async function computeTotalRetentionWithheld(projectId: string): Promise<number> {
  const [claims, contractTerms] = await Promise.all([
    prisma.paymentClaim.findMany({ where: { projectId, status: { not: "draft" } }, select: { claimedAmount: true } }),
    prisma.contractTerms.findUnique({ where: { projectId }, select: { retentionPercent: true } })
  ]);

  const retentionPercent = contractTerms?.retentionPercent ?? 0;
  const total = claims.reduce((sum, claim) => sum + Number(claim.claimedAmount) * (retentionPercent / 100), 0);
  return round2(total);
}

// "Withheld" (above) is the cumulative, historical amount ever deducted
// from a claim — it never goes down, even after a tranche is released
// (matches Appendix B1's own "Less retention" line, a running deduction,
// not a live balance). "Currently held" is the number that actually
// matters when asking "how much of my money does this Main Contractor
// still have" — withheld minus whatever's genuinely been released so far.
export async function computeNetRetentionCurrentlyHeld(projectId: string): Promise<number> {
  const [totalWithheld, retention] = await Promise.all([
    computeTotalRetentionWithheld(projectId),
    prisma.retention.findUnique({
      where: { projectId },
      select: { tranche1ReleasedAmount: true, tranche2ReleasedAmount: true }
    })
  ]);

  const released = Number(retention?.tranche1ReleasedAmount ?? 0) + Number(retention?.tranche2ReleasedAmount ?? 0);
  return round2(totalWithheld - released);
}

// Summed across every project belonging to one Main Contractor — the
// "Exceed" rollup (a subbie running several concurrent jobs with the same
// head contractor wants to see what's currently held across all of them,
// not just one project at a time). Uses the NET figure above, not gross
// withheld, since "currently held" is what a subbie actually wants to
// know here — reuses the identical per-project calculation, just grouped
// differently.
export async function computeTotalRetentionWithheldForMainContractor(mainContractorId: string): Promise<number> {
  const projects = await prisma.project.findMany({ where: { mainContractorId }, select: { id: true } });
  const totals = await Promise.all(projects.map((project) => computeNetRetentionCurrentlyHeld(project.id)));
  return round2(totals.reduce((sum, total) => sum + total, 0));
}

// The computed status label (Retention V2 plan §7.1) — never stored,
// always derived fresh from the same fields getRetentionSummary already
// reads, exactly the same "don't store what can be correctly derived"
// discipline already applied to totalWithheld above. `windowDays` is the
// one deliberately simple, documented threshold this uses to give real
// content to "in defects period" vs "final release due" (the brief's own
// state list has no equivalent "not yet due" state for the FIRST tranche
// — completion is either not yet confirmed, or a confirmed date is
// simply due-or-overdue — so no threshold is needed there).
const UPCOMING_WINDOW_DAYS = 30;

export type RetentionStatus =
  | "not_configured"
  | "accumulating"
  | "awaiting_completion"
  | "initial_release_due"
  | "initial_release_overdue"
  | "in_defects_period"
  | "final_release_due"
  | "final_release_overdue"
  | "fully_released";

export function computeRetentionStatus(params: {
  retentionApplies: boolean | null;
  retentionPercent: number | null;
  projectStatus: string;
  completionConfirmed: boolean;
  tranche1ExpectedDate: Date | null;
  tranche1ReleasedAt: Date | null;
  tranche2ExpectedDate: Date | null;
  tranche2ReleasedAt: Date | null;
  today?: Date;
}): RetentionStatus {
  const today = startOfDay(params.today ?? new Date());

  if (params.retentionApplies === false || (!params.retentionApplies && !params.retentionPercent)) {
    return "not_configured";
  }

  if (params.tranche2ReleasedAt) return "fully_released";

  if (!params.tranche1ReleasedAt) {
    if (!params.completionConfirmed) {
      return params.projectStatus === "active" ? "accumulating" : "awaiting_completion";
    }
    if (!params.tranche1ExpectedDate) return "awaiting_completion";
    return startOfDay(params.tranche1ExpectedDate).getTime() < today.getTime() ? "initial_release_overdue" : "initial_release_due";
  }

  // Tranche 1 released, tranche 2 not.
  if (!params.tranche2ExpectedDate) return "in_defects_period";
  const tranche2Day = startOfDay(params.tranche2ExpectedDate).getTime();
  const daysUntil = Math.round((tranche2Day - today.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntil < 0) return "final_release_overdue";
  if (daysUntil <= UPCOMING_WINDOW_DAYS) return "final_release_due";
  return "in_defects_period";
}

export type RetentionSummary = {
  totalWithheld: number;
  retentionApplies: boolean;
  retentionPercent: number;
  completionOfWorksDate: Date | null;
  completionOfWorksConfirmedAt: Date | null;
  completionOfWorksNote: string | null;
  status: RetentionStatus;
  requiresReview: boolean;
  reviewNotes: string | null;
  initialReleaseTrigger: RetentionReleaseTrigger | null;
  finalReleaseTrigger: RetentionReleaseTrigger | null;
  tranche1: {
    expectedDate: Date | null;
    percent: number | null;
    expectedAmount: number | null;
    releasedAmount: number | null;
    releasedAt: Date | null;
  };
  tranche2: {
    expectedDate: Date | null;
    percent: number | null;
    expectedAmount: number | null;
    releasedAmount: number | null;
    releasedAt: Date | null;
  };
};

function resolveTiming(
  days: number | null,
  unit: RetentionTimingUnit | null,
  anchorEndOfMonth: boolean | null
): { days: number | null; unit: RetentionTimingUnit | null; anchorEndOfMonth: boolean } {
  return { days, unit, anchorEndOfMonth: anchorEndOfMonth ?? false };
}

// The full picture the Retention card on the Payment Claims page renders —
// one call, everything already resolved (defaults applied, amounts and
// dates computed), so the UI never has to re-derive this logic itself.
export async function getRetentionSummary(projectId: string): Promise<RetentionSummary> {
  const [totalWithheld, contractTerms, retention, project] = await Promise.all([
    computeTotalRetentionWithheld(projectId),
    prisma.contractTerms.findUnique({
      where: { projectId },
      select: {
        retentionApplies: true,
        retentionPercent: true,
        defectsLiabilityPeriodDays: true,
        initialReleaseTrigger: true,
        initialReleaseTimingDays: true,
        initialReleaseTimingUnit: true,
        initialReleaseAnchorEndOfMonth: true,
        finalReleaseTrigger: true,
        finalReleaseTimingDays: true,
        finalReleaseTimingUnit: true,
        finalReleaseAnchorEndOfMonth: true,
        retentionRequiresReview: true,
        retentionReviewNotes: true
      }
    }),
    prisma.retention.findUnique({ where: { projectId } }),
    prisma.project.findUnique({ where: { id: projectId }, select: { completedAt: true, status: true } })
  ]);

  // The best-known completion-of-Subcontract-Works date: an explicit
  // confirmation (the new, deliberate action — see confirmCompletionOfWorks
  // below) takes priority; falling back to a manual override, then to
  // Project.completedAt, exactly as this feature has always defaulted —
  // renamed from V1's practicalCompletionDateOverride (see the Retention
  // model's own schema comment for why that name was wrong).
  const completionOfWorksDate =
    retention?.completionOfWorksConfirmedAt ?? retention?.completionOfWorksDateOverride ?? project?.completedAt ?? null;

  // Tranche 1's expected date: an explicit override on the row always
  // wins; otherwise, once completion is known, compute it from
  // ContractTerms' own extracted/confirmed timing — this is the one place
  // the new contract-aware timing actually reaches a real date, rather
  // than V1's plain "defaults to completion itself" behaviour. Falls all
  // the way back to the completion date itself when no timing is stated
  // at all (V1's original behaviour, unchanged, for a project with no
  // extracted timing).
  let tranche1ExpectedDate = retention?.tranche1ExpectedDate ?? null;
  if (!tranche1ExpectedDate && completionOfWorksDate) {
    const timing = resolveTiming(
      contractTerms?.initialReleaseTimingDays ?? null,
      contractTerms?.initialReleaseTimingUnit ?? null,
      contractTerms?.initialReleaseAnchorEndOfMonth ?? null
    );
    const anchor = timing.anchorEndOfMonth ? endOfMonth(completionOfWorksDate) : completionOfWorksDate;
    tranche1ExpectedDate = computeReleaseDate(anchor, timing) ?? completionOfWorksDate;
  }

  // Tranche 2 defaults to tranche 1's date + the contract's Defects
  // Liability Period (or ContractTerms' own extracted final-release
  // timing, if more specific timing was extracted than a plain DLP day
  // count) — computed here, in application code, every time rather than
  // stored, so editing either input automatically keeps this default in
  // step; an explicit tranche2ExpectedDate on the row always overrides
  // this.
  let tranche2ExpectedDate = retention?.tranche2ExpectedDate ?? null;
  if (!tranche2ExpectedDate && tranche1ExpectedDate) {
    const finalTiming = resolveTiming(
      contractTerms?.finalReleaseTimingDays ?? null,
      contractTerms?.finalReleaseTimingUnit ?? null,
      contractTerms?.finalReleaseAnchorEndOfMonth ?? null
    );
    if (finalTiming.days != null && finalTiming.unit) {
      const anchor = finalTiming.anchorEndOfMonth ? endOfMonth(tranche1ExpectedDate) : tranche1ExpectedDate;
      tranche2ExpectedDate = computeReleaseDate(anchor, finalTiming);
    } else if (contractTerms?.defectsLiabilityPeriodDays != null) {
      tranche2ExpectedDate = new Date(tranche1ExpectedDate);
      tranche2ExpectedDate.setDate(tranche2ExpectedDate.getDate() + contractTerms.defectsLiabilityPeriodDays);
    }
  }

  const tranche1Percent = retention?.tranche1Percent ?? null;
  const tranche2Percent = retention?.tranche2Percent ?? null;
  const retentionApplies = contractTerms?.retentionApplies ?? (contractTerms?.retentionPercent != null);

  const status = computeRetentionStatus({
    retentionApplies: contractTerms?.retentionApplies ?? null,
    retentionPercent: contractTerms?.retentionPercent ?? null,
    projectStatus: project?.status ?? "active",
    completionConfirmed: retention?.completionOfWorksConfirmedAt != null,
    tranche1ExpectedDate,
    tranche1ReleasedAt: retention?.tranche1ReleasedAt ?? null,
    tranche2ExpectedDate,
    tranche2ReleasedAt: retention?.tranche2ReleasedAt ?? null
  });

  return {
    totalWithheld,
    retentionApplies,
    retentionPercent: contractTerms?.retentionPercent ?? 0,
    completionOfWorksDate,
    completionOfWorksConfirmedAt: retention?.completionOfWorksConfirmedAt ?? null,
    completionOfWorksNote: retention?.completionOfWorksNote ?? null,
    status,
    requiresReview: contractTerms?.retentionRequiresReview ?? false,
    reviewNotes: contractTerms?.retentionReviewNotes ?? null,
    initialReleaseTrigger: contractTerms?.initialReleaseTrigger ?? null,
    finalReleaseTrigger: contractTerms?.finalReleaseTrigger ?? null,
    tranche1: {
      expectedDate: tranche1ExpectedDate,
      percent: tranche1Percent,
      expectedAmount: tranche1Percent != null ? round2(totalWithheld * (tranche1Percent / 100)) : null,
      releasedAmount: retention?.tranche1ReleasedAmount != null ? Number(retention.tranche1ReleasedAmount) : null,
      releasedAt: retention?.tranche1ReleasedAt ?? null
    },
    tranche2: {
      expectedDate: tranche2ExpectedDate,
      percent: tranche2Percent,
      expectedAmount: tranche2Percent != null ? round2(totalWithheld * (tranche2Percent / 100)) : null,
      releasedAmount: retention?.tranche2ReleasedAmount != null ? Number(retention.tranche2ReleasedAmount) : null,
      releasedAt: retention?.tranche2ReleasedAt ?? null
    }
  };
}

// The explicit confirmation action (Retention V2 plan §6.1) — distinct
// from just reading Project.completedAt passively. Logs a
// RecordLifecycleEvent (reusing the existing shared audit table rather
// than a retention-specific one — see that model's own schema comment)
// so "when did we confirm completion, and who confirmed it" is always
// traceable, the same discipline already applied to every other
// close/reactivate/complete transition in this codebase.
export async function confirmCompletionOfWorks(params: {
  projectId: string;
  confirmedAt: Date;
  note?: string | null;
  userId: string;
}): Promise<void> {
  const existing = await prisma.retention.findUnique({ where: { projectId: params.projectId } });

  await prisma.retention.upsert({
    where: { projectId: params.projectId },
    update: {
      completionOfWorksConfirmedAt: params.confirmedAt,
      completionOfWorksNote: params.note ?? undefined
    },
    create: {
      projectId: params.projectId,
      completionOfWorksConfirmedAt: params.confirmedAt,
      completionOfWorksNote: params.note ?? null
    }
  });

  await recordLifecycleEvent({
    entityType: "retention",
    entityId: params.projectId,
    eventType: "milestone",
    userId: params.userId,
    previousState: existing?.completionOfWorksConfirmedAt ? "completion_confirmed" : "awaiting_completion",
    newState: "completion_confirmed",
    note: params.note ?? null
  });
}

// Logs a release (initial or final) with the same audit trail as
// confirmCompletionOfWorks above — called from the PATCH route right
// after it writes the tranche's releasedAmount/releasedAt fields, not a
// replacement for that write.
export async function logRetentionMilestone(params: {
  projectId: string;
  newState: string;
  userId: string;
  note?: string | null;
}): Promise<void> {
  await recordLifecycleEvent({
    entityType: "retention",
    entityId: params.projectId,
    eventType: "milestone",
    userId: params.userId,
    newState: params.newState,
    note: params.note ?? null
  });
}

// Structural copy of lib/payment-claim.ts's linkClaimEvidence/
// getClaimEvidence (Retention V2 plan §8) — same polymorphic evidence
// chain (variation_package/correspondence/external_action/qa_record/
// update), reused directly via ClaimEvidenceType rather than a duplicate
// enum, just keyed off a Retention row instead of a PaymentClaim.
export async function linkRetentionEvidence(params: {
  projectId: string;
  evidenceType: ClaimEvidenceType;
  evidenceId: string;
}): Promise<void> {
  const retention = await prisma.retention.upsert({
    where: { projectId: params.projectId },
    update: {},
    create: { projectId: params.projectId }
  });
  await prisma.retentionEvidenceLink
    .create({ data: { retentionId: retention.id, evidenceType: params.evidenceType, evidenceId: params.evidenceId } })
    .catch(() => undefined); // unique constraint — already linked, harmless no-op
}

export async function unlinkRetentionEvidence(params: {
  projectId: string;
  evidenceType: ClaimEvidenceType;
  evidenceId: string;
}): Promise<void> {
  const retention = await prisma.retention.findUnique({ where: { projectId: params.projectId } });
  if (!retention) return;
  await prisma.retentionEvidenceLink
    .delete({
      where: { retentionId_evidenceType_evidenceId: { retentionId: retention.id, evidenceType: params.evidenceType, evidenceId: params.evidenceId } }
    })
    .catch(() => undefined);
}

export type ResolvedRetentionEvidence = { evidenceType: ClaimEvidenceType; evidenceId: string; label: string; href: string | null };

// Resolves each polymorphic link back to a real, displayable row — mirrors
// lib/payment-claim.ts's getClaimEvidence resolver switch statement
// exactly (genuinely copy-derived, not a new design), since the same five
// evidence kinds apply here.
export async function getRetentionEvidence(projectId: string): Promise<ResolvedRetentionEvidence[]> {
  const retention = await prisma.retention.findUnique({ where: { projectId }, include: { evidenceLinks: true } });
  if (!retention) return [];

  const resolved: ResolvedRetentionEvidence[] = [];
  for (const link of retention.evidenceLinks) {
    switch (link.evidenceType) {
      case "variation_package": {
        const pkg = await prisma.variationPackage.findUnique({ where: { id: link.evidenceId }, select: { fileName: true, variationItemId: true } });
        resolved.push({
          evidenceType: link.evidenceType,
          evidenceId: link.evidenceId,
          label: pkg?.fileName ?? "Variation Package",
          href: pkg ? `/projects/${projectId}/variations/${pkg.variationItemId}` : null
        });
        break;
      }
      case "correspondence": {
        const item = await prisma.correspondence.findUnique({ where: { id: link.evidenceId }, select: { title: true, variationItemId: true } });
        resolved.push({
          evidenceType: link.evidenceType,
          evidenceId: link.evidenceId,
          label: item?.title ?? "Correspondence",
          href: item?.variationItemId ? `/projects/${projectId}/variations/${item.variationItemId}` : `/projects/${projectId}/correspondence`
        });
        break;
      }
      case "external_action": {
        const action = await prisma.externalAction.findUnique({ where: { id: link.evidenceId }, select: { type: true, variationItemId: true, status: true } });
        resolved.push({
          evidenceType: link.evidenceType,
          evidenceId: link.evidenceId,
          label: action ? `${action.type} — ${action.status}` : "External Action",
          href: action?.variationItemId ? `/projects/${projectId}/variations/${action.variationItemId}` : null
        });
        break;
      }
      case "qa_record": {
        const record = await prisma.qARecord.findUnique({ where: { id: link.evidenceId }, select: { stage: true } });
        resolved.push({
          evidenceType: link.evidenceType,
          evidenceId: link.evidenceId,
          label: record?.stage ?? "QA Record",
          href: `/projects/${projectId}/quality-assurance`
        });
        break;
      }
      case "update": {
        const update = await prisma.update.findUnique({ where: { id: link.evidenceId }, select: { body: true } });
        resolved.push({
          evidenceType: link.evidenceType,
          evidenceId: link.evidenceId,
          label: update ? (update.body.length > 60 ? `${update.body.slice(0, 60)}...` : update.body) : "Project Diary entry",
          href: `/projects/${projectId}/updates#${link.evidenceId}`
        });
        break;
      }
    }
  }
  return resolved;
}
