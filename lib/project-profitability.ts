import { prisma } from "./prisma";
import { getVisibleProjectsWhere, getOrganisationMembership } from "./organisation";
import { isVariationApproved } from "./payment-claim";
import { computeLabourSummary, computePackageTotals } from "./variation-package";
import {
  computeScheduleClaimBreakdown,
  computeScheduleTotalValue,
  getContractScheduleForProject,
  sumBreakdown
} from "./contract-schedule";
import { computeTotalRetentionWithheld } from "./retention";
import { getActiveCommercialReviewItems } from "./commercial-review";
import {
  getLatestConfirmedReconciliationsForProject,
  summarizePaymentTracking,
  type PaymentTrackingSummary
} from "./payment-reconciliation";

// ============================================================
// "Project Profitability" — a REPORTING layer over data every other module
// already owns (Contract Schedule, Variations/Site Instructions, Payment
// Claims, Retention, Day Works cost capture). This file computes nothing
// that isn't already derivable from those modules' own tables; it exists
// purely to combine their outputs into one project-wide (and, via
// getPortfolioProfitabilitySummary, cross-project) view.
//
// Why margin is scoped to Variations/Site Instructions only: base Contract
// Schedule work (the "original subcontract sum") has NO cost model
// anywhere in this schema — only its claimed VALUE is tracked
// (lib/contract-schedule.ts). Only Variations/SI carry both a claimed
// value (VariationItem.variationValue, via claim allocations) AND a
// recorded cost (Day Works labour/materials/plant, via
// computePackageTotals). A true whole-project margin is therefore not
// calculable, and this module must never imply one — "base contract cost"
// is always represented as `baseContractCostTracked: false`, never as a
// fabricated $0.
//
// Payment Received architecture (Task 5 — now implemented). The chain
// documented here when this file was first built is now real:
//   PaymentClaim.claimedAmount (existing)
//     -> ContractorPaymentSchedule (lib/payment-reconciliation.ts) — the
//        main contractor's response, certifiedAmount/declinedAmount
//     -> retention (existing, lib/retention.ts — orthogonal, unchanged)
//     -> credits/adjustments (PaymentReconciliationAdjustment)
//     -> receivedAmount / paymentReceivedDate (on ContractorPaymentSchedule)
//     -> outstanding (derived: certifiedAmount - receivedAmount, never
//        claimedAmount - receivedAmount, since a main contractor is only
//        ever obliged to pay what they certified)
// `payments` below is computed by lib/payment-reconciliation.ts's own
// summarizePaymentTracking — see that function for exactly how
// certifiedToDate/receivedToDate/outstanding/awaitingReceiptConfirmation
// are kept as honestly separate figures (an unrecorded receipt is never
// folded into either receivedToDate or outstanding).
// ============================================================

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export type ProjectProfitabilitySummary = {
  projectId: string;
  projectName: string;
  // The date every "to date" figure below is measured as of. Live for an
  // active project (today); frozen at closedAt ?? completedAt for a
  // completed/closed one, so a closed project's profitability page never
  // silently drifts as unrelated later activity (e.g. a defects-period
  // Update) occurs.
  asOfDate: Date;
  isFrozen: boolean;
  hasContractSchedule: boolean;

  contractValue: {
    // 0 whenever hasContractSchedule is false — always render conditionally
    // on hasContractSchedule, never as a bare number, since a project with
    // no schedule yet has an UNKNOWN original value, not a zero one.
    original: number;
    approvedVariations: number;
    revised: number;
    awaitingApprovalVariations: number;
  };

  claims: {
    // Gross claimed to date across BOTH the Contract Schedule and approved
    // Variations/SI (same basis as Payment Claim's own "claimed to date").
    claimedToDate: number;
    retentionWithheld: number;
    netClaimedToDate: number;
    payments: PaymentTrackingSummary;
  };

  cost: {
    labour: number;
    materials: number;
    materialsMarkup: number;
    plant: number;
    // labour + materials + materialsMarkup + plant, recorded against
    // Variations/SI only — never the whole project. See this file's header
    // comment.
    total: number;
    hoursMissingRateTotal: number;
    baseContractCostTracked: false;
  };

  margin: {
    // The revenue basis the margin below is measured against — approved
    // Variations/SI claimed to date. Exposed so a portfolio-level margin %
    // can be computed as a true weighted average (sum of profit / sum of
    // this), never as an average of each project's own percentage.
    variationsClaimedToDate: number;
    // null when variationsClaimedToDate is 0 — nothing has been claimed
    // against a Variation/SI yet, so there is no margin to report (not a
    // 0% margin, which would misleadingly suggest cost exactly matched
    // revenue).
    recordedMarginOnVariations: number | null;
    recordedMarginPercent: number | null;
  };

  // Site Instructions with recorded Day Works cost that have never been
  // turned into a priced Variation (variationCreatedAt still null) —
  // invisible everywhere else in the app today.
  unpricedSiteInstructions: {
    count: number;
    recordedCost: number;
  };
};

async function computeProjectProfitability(project: {
  id: string;
  name: string;
  closedAt: Date | null;
  completedAt: Date | null;
}): Promise<ProjectProfitabilitySummary> {
  const isFrozen = project.closedAt != null || project.completedAt != null;
  const asOfDate = project.closedAt ?? project.completedAt ?? new Date();

  const [schedule, contractTerms, variations, reconciliations] = await Promise.all([
    getContractScheduleForProject(project.id),
    prisma.contractTerms.findUnique({
      where: { projectId: project.id },
      select: { materialsMarkupPercent: true }
    }),
    prisma.variationItem.findMany({
      where: { projectId: project.id, variationCreatedAt: { not: null } },
      select: {
        variationValue: true,
        claimAllocations: { select: { amount: true } },
        sheetRecords: true,
        materials: true,
        plant: true
      }
    }),
    getLatestConfirmedReconciliationsForProject(project.id)
  ]);

  const originalContractValue = schedule ? computeScheduleTotalValue(schedule) : 0;
  const scheduleClaimedToDate = schedule
    ? sumBreakdown(computeScheduleClaimBreakdown(schedule, asOfDate, asOfDate, null)).claimedToDate
    : 0;

  let approvedVariationsTotal = 0;
  let awaitingApprovalVariationsTotal = 0;
  let variationsClaimedToDate = 0;
  let labourTotal = 0;
  let materialsTotal = 0;
  let materialsMarkupTotal = 0;
  let plantTotal = 0;
  let hoursMissingRateTotal = 0;

  for (const item of variations) {
    const totalAllocated = item.claimAllocations.reduce((sum, allocation) => sum + Number(allocation.amount), 0);
    const value = item.variationValue != null ? Number(item.variationValue) : 0;

    if (isVariationApproved(totalAllocated)) {
      approvedVariationsTotal += value;
      variationsClaimedToDate += totalAllocated;
    } else {
      awaitingApprovalVariationsTotal += value;
    }

    const totals = computePackageTotals(item.sheetRecords, item.materials, item.plant, contractTerms);
    labourTotal += totals.labourTotal;
    materialsTotal += totals.materialsTotal;
    materialsMarkupTotal += totals.materialsMarkupTotal;
    plantTotal += totals.plantTotal;
    hoursMissingRateTotal += computeLabourSummary(item.sheetRecords).hoursMissingRate;
  }

  const costTotal = labourTotal + materialsTotal + materialsMarkupTotal + plantTotal;
  const grossClaimedToDate = scheduleClaimedToDate + variationsClaimedToDate;
  const retentionWithheld = await computeTotalRetentionWithheld(project.id);
  const netClaimedToDate = grossClaimedToDate - retentionWithheld;

  const recordedMarginOnVariations = variationsClaimedToDate > 0 ? round2(variationsClaimedToDate - costTotal) : null;
  const recordedMarginPercent =
    recordedMarginOnVariations != null ? round2((recordedMarginOnVariations / variationsClaimedToDate) * 100) : null;

  // Cost recorded on Site Instructions that have never been priced as a
  // Variation — currently invisible everywhere else in the app.
  const unpricedItems = await prisma.variationItem.findMany({
    where: {
      projectId: project.id,
      variationCreatedAt: null,
      OR: [{ sheetRecords: { some: {} } }, { materials: { some: {} } }, { plant: { some: {} } }]
    },
    select: { sheetRecords: true, materials: true, plant: true }
  });
  const unpricedSiCost = unpricedItems.reduce(
    (sum, item) => sum + computePackageTotals(item.sheetRecords, item.materials, item.plant, contractTerms).grandTotal,
    0
  );

  return {
    projectId: project.id,
    projectName: project.name,
    asOfDate,
    isFrozen,
    hasContractSchedule: Boolean(schedule),
    contractValue: {
      original: round2(originalContractValue),
      approvedVariations: round2(approvedVariationsTotal),
      revised: round2(originalContractValue + approvedVariationsTotal),
      awaitingApprovalVariations: round2(awaitingApprovalVariationsTotal)
    },
    claims: {
      claimedToDate: round2(grossClaimedToDate),
      retentionWithheld: round2(retentionWithheld),
      netClaimedToDate: round2(netClaimedToDate),
      payments: summarizePaymentTracking(round2(grossClaimedToDate), reconciliations)
    },
    cost: {
      labour: round2(labourTotal),
      materials: round2(materialsTotal),
      materialsMarkup: round2(materialsMarkupTotal),
      plant: round2(plantTotal),
      total: round2(costTotal),
      hoursMissingRateTotal: round2(hoursMissingRateTotal),
      baseContractCostTracked: false
    },
    margin: {
      variationsClaimedToDate: round2(variationsClaimedToDate),
      recordedMarginOnVariations,
      recordedMarginPercent
    },
    unpricedSiteInstructions: {
      count: unpricedItems.length,
      recordedCost: round2(unpricedSiCost)
    }
  };
}

// Per-project entry point (backs /projects/[projectId]/profitability). No
// permission check inside — matches every other lib/*.ts data function in
// this codebase (getPaymentClaimComputedData, getRetentionSummary, etc.):
// the caller (page/route) is responsible for verifying project access via
// requireProjectAccess + the payment_claims module, same gate the
// Payment Claims/Contract Schedule tabs already share.
export async function getProjectProfitability(projectId: string): Promise<ProjectProfitabilitySummary | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, closedAt: true, completedAt: true }
  });
  if (!project) return null;

  return computeProjectProfitability(project);
}

export type PortfolioProfitabilitySummary = {
  asOfDate: Date;
  projectCount: number;
  contractValue: { revised: number };
  cost: { total: number };
  margin: {
    variationsClaimedToDate: number;
    recordedGrossProfit: number | null;
    recordedGrossMarginPercent: number | null;
  };
  claims: {
    claimedToDate: number;
    netClaimedToDate: number;
    payments: PaymentTrackingSummary;
  };
  approvedVariationsTotal: number;
  commercialItemsRequiringReview: number;
  projects: {
    projectId: string;
    projectName: string;
    revisedContractValue: number;
    recordedCost: number;
    recordedMargin: number | null;
    claimedToDate: number;
    certifiedToDate: number;
    receivedToDate: number;
    outstanding: number;
  }[];
};

// Cross-project financial data — gated to isAdmin specifically (stricter
// than the per-project page's module check), matching the precedent
// already set for the Commercial Review dashboard section
// (canViewCommercialReview). An org-less legacy project user counts as
// "admin enough" here too, same convention every other org-gated
// dashboard section uses for org-less projects.
export async function canViewPortfolioProfitability(userId: string): Promise<boolean> {
  const membership = await getOrganisationMembership(userId);
  return !membership || membership.isAdmin;
}

// Aggregates ACTIVE projects only (Project.status === "active") — a
// closed/completed project's frozen figures are still fully visible on its
// own /profitability page, but never counted into this live, changing
// portfolio total. See lib/project-lifecycle.ts for the status contract.
export async function getPortfolioProfitabilitySummary(userId: string): Promise<PortfolioProfitabilitySummary | null> {
  if (!(await canViewPortfolioProfitability(userId))) return null;

  const visibleWhere = await getVisibleProjectsWhere(userId);
  const projects = await prisma.project.findMany({
    where: { ...visibleWhere, status: "active" },
    select: { id: true, name: true, closedAt: true, completedAt: true }
  });

  const summaries = await Promise.all(projects.map((project) => computeProjectProfitability(project)));
  const commercialItemsRequiringReview = (await getActiveCommercialReviewItems(userId)).length;

  let revisedContractValueTotal = 0;
  let costTotal = 0;
  let claimedToDateTotal = 0;
  let netClaimedToDateTotal = 0;
  let approvedVariationsTotal = 0;
  let variationsClaimedToDateTotal = 0;
  let recordedMarginTotal = 0;
  let certifiedToDateTotal = 0;
  let receivedToDateTotal = 0;
  let outstandingTotal = 0;
  let awaitingReceiptConfirmationTotal = 0;

  for (const summary of summaries) {
    revisedContractValueTotal += summary.contractValue.revised;
    costTotal += summary.cost.total;
    claimedToDateTotal += summary.claims.claimedToDate;
    netClaimedToDateTotal += summary.claims.netClaimedToDate;
    approvedVariationsTotal += summary.contractValue.approvedVariations;
    variationsClaimedToDateTotal += summary.margin.variationsClaimedToDate;
    recordedMarginTotal += summary.margin.recordedMarginOnVariations ?? 0;
    certifiedToDateTotal += summary.claims.payments.certifiedToDate;
    receivedToDateTotal += summary.claims.payments.receivedToDate;
    outstandingTotal += summary.claims.payments.outstanding;
    awaitingReceiptConfirmationTotal += summary.claims.payments.awaitingReceiptConfirmation;
  }

  return {
    asOfDate: new Date(),
    projectCount: summaries.length,
    contractValue: { revised: round2(revisedContractValueTotal) },
    cost: { total: round2(costTotal) },
    margin: {
      variationsClaimedToDate: round2(variationsClaimedToDateTotal),
      recordedGrossProfit: summaries.length > 0 ? round2(recordedMarginTotal) : null,
      recordedGrossMarginPercent:
        variationsClaimedToDateTotal > 0 ? round2((recordedMarginTotal / variationsClaimedToDateTotal) * 100) : null
    },
    claims: {
      claimedToDate: round2(claimedToDateTotal),
      netClaimedToDate: round2(netClaimedToDateTotal),
      payments: {
        certifiedToDate: round2(certifiedToDateTotal),
        receivedToDate: round2(receivedToDateTotal),
        outstanding: round2(outstandingTotal),
        awaitingReceiptConfirmation: round2(awaitingReceiptConfirmationTotal),
        uncertifiedToDate: round2(claimedToDateTotal - certifiedToDateTotal),
        trackingEnabled: true
      }
    },
    approvedVariationsTotal: round2(approvedVariationsTotal),
    commercialItemsRequiringReview,
    projects: summaries
      .map((summary) => ({
        projectId: summary.projectId,
        projectName: summary.projectName,
        revisedContractValue: summary.contractValue.revised,
        recordedCost: summary.cost.total,
        recordedMargin: summary.margin.recordedMarginOnVariations,
        claimedToDate: summary.claims.claimedToDate,
        certifiedToDate: summary.claims.payments.certifiedToDate,
        receivedToDate: summary.claims.payments.receivedToDate,
        outstanding: summary.claims.payments.outstanding
      }))
      .sort((a, b) => b.revisedContractValue - a.revisedContractValue)
  };
}
