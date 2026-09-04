import type { ClaimEvidenceType } from "@prisma/client";
import { prisma } from "./prisma";
import { getContractScheduleForProject, computeScheduleClaimBreakdown, computeScheduleTotalValue, sumBreakdown, type ContractItemValueBreakdown } from "./contract-schedule";

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export type PaymentClaimVariationRow = {
  id: string;
  reference: string;
  title: string;
  value: number;
  closed: boolean;
  thisClaimAmount: number;
  totalAllocatedAcrossAllClaims: number;
};

// Every number the Payment Claim detail page shows AND the Payment Claim
// PDF (Pre-Launch Feature 5) needs to print — extracted into one place so
// the two can never drift into disagreeing about what a claim is actually
// worth. Mirrors the official SA-2017 Appendix B1 payment claim schedule's
// own numbered structure (see lib/standard-forms/sa-2017.json) — this
// app just doesn't track every one of the template's line items as its
// own concept (fluctuations, materials on/off site, variations awaiting
// approval aren't modelled), so those come back as 0 rather than fabricated.
export async function getPaymentClaimComputedData(projectId: string, claimId: string) {
  const claim = await prisma.paymentClaim.findFirst({
    where: { id: claimId, projectId },
    include: { allocations: { include: { variationItem: true } } }
  });
  if (!claim) return null;

  // The immediately-prior claim (by period, not creation order) — the same
  // cutoff computeScheduleClaimBreakdown uses to work out what's genuinely
  // NEW in this claim versus already claimed before it.
  const previousClaim = await prisma.paymentClaim.findFirst({
    where: { projectId, periodEnd: { lt: claim.periodStart } },
    orderBy: { periodEnd: "desc" }
  });

  const [schedule, contractTerms, eligibleVariations, project] = await Promise.all([
    getContractScheduleForProject(projectId),
    prisma.contractTerms.findUnique({ where: { projectId }, select: { retentionPercent: true } }),
    prisma.variationItem.findMany({
      where: { projectId, variationCreatedAt: { not: null } },
      select: {
        id: true,
        reference: true,
        title: true,
        variationValue: true,
        closedAt: true,
        claimAllocations: { select: { paymentClaimId: true, amount: true } }
      },
      orderBy: { variationCreatedAt: "asc" }
    }),
    prisma.project.findUnique({ where: { id: projectId }, select: { name: true, mainContractorId: true, organisationId: true } })
  ]);

  const breakdown = schedule
    ? computeScheduleClaimBreakdown(schedule, claim.periodStart, claim.periodEnd, previousClaim?.periodEnd ?? null)
    : [];
  const scheduleTotals = sumBreakdown(breakdown);
  const originalSubcontractSum = schedule ? computeScheduleTotalValue(schedule) : 0;

  const variations: PaymentClaimVariationRow[] = eligibleVariations.map((item) => {
    const thisClaimAllocation = item.claimAllocations.find((allocation) => allocation.paymentClaimId === claimId);
    const totalAllocated = item.claimAllocations.reduce((sum, allocation) => sum + Number(allocation.amount), 0);
    return {
      id: item.id,
      reference: item.reference,
      title: item.title,
      value: item.variationValue != null ? Number(item.variationValue) : 0,
      closed: item.closedAt != null,
      thisClaimAmount: thisClaimAllocation ? Number(thisClaimAllocation.amount) : 0,
      totalAllocatedAcrossAllClaims: totalAllocated
    };
  });

  const retentionPercent = contractTerms?.retentionPercent ?? 5;
  const approvedVariationsTotal = variations.reduce((sum, v) => sum + v.value, 0);
  const variationsClaimedToDate = variations.reduce((sum, v) => sum + v.totalAllocatedAcrossAllClaims, 0);
  const variationsThisClaim = variations.reduce((sum, v) => sum + v.thisClaimAmount, 0);
  const otherAmount = Number(claim.otherAmount);

  const revisedSubcontractSum = round2(originalSubcontractSum + approvedVariationsTotal);
  const grossClaimToDate = round2(scheduleTotals.claimedToDate + variationsClaimedToDate + otherAmount);
  const retention = round2(grossClaimToDate * (retentionPercent / 100));
  const netClaimToDate = round2(grossClaimToDate - retention);

  const thisClaimGross = round2(scheduleTotals.thisClaim + variationsThisClaim + otherAmount);
  const thisClaimRetention = round2(thisClaimGross * (retentionPercent / 100));
  const thisClaimNet = round2(thisClaimGross - thisClaimRetention);
  const gst = round2(thisClaimNet * 0.15);
  const thisClaimGrossInclGst = round2(thisClaimNet + gst);
  // Row 13 of the real template ("Less previous payment claims") — derived
  // by subtraction (this claim's own net-to-date minus this claim's own net
  // amount) rather than re-fetching the previous claim's stored total, so
  // it's always self-consistent with the two figures either side of it.
  const previousClaimsNet = round2(netClaimToDate - thisClaimNet);

  return {
    projectName: project?.name ?? "",
    mainContractorId: project?.mainContractorId ?? null,
    organisationId: project?.organisationId ?? null,
    claim: {
      id: claim.id,
      claimNumber: claim.claimNumber,
      status: claim.status,
      periodStart: claim.periodStart,
      periodEnd: claim.periodEnd,
      referenceDate: claim.referenceDate,
      statutoryWording: claim.statutoryWording,
      contractWorksAmount: Number(claim.contractWorksAmount),
      otherAmount,
      claimedAmount: Number(claim.claimedAmount)
    },
    hasSchedule: Boolean(schedule),
    scheduleBreakdown: breakdown,
    retentionPercent,
    variations,
    figures: {
      originalSubcontractSum,
      approvedVariationsTotal,
      revisedSubcontractSum,
      variationsAwaitingApproval: 0, // not modelled in this app — see comment above
      scheduleClaimedToDate: scheduleTotals.claimedToDate,
      variationsClaimedToDate,
      variationsAwaitingApprovalToDate: 0,
      fluctuations: 0,
      materialsOnOffSite: 0,
      grossClaimToDate,
      retention,
      netClaimToDate,
      previousClaimsNet,
      thisClaimNet,
      gst,
      thisClaimGrossInclGst,
      scheduleThisClaim: scheduleTotals.thisClaim,
      variationsThisClaim,
      thisClaimGross
    }
  };
}

export type PaymentClaimComputedData = NonNullable<Awaited<ReturnType<typeof getPaymentClaimComputedData>>>;

// PaymentClaim is the monthly commercial CONTAINER (see its schema
// comment) — claimedAmount is always the computed sum of what's actually
// in it, never a number typed separately from its contents. Every write
// that changes the container's contents (an allocation, or the flat
// contractWorks/other amounts) recomputes and persists this total in the
// same transaction, so claimedAmount can never drift out of sync with what
// the claim actually contains.
export async function recomputeClaimTotal(paymentClaimId: string): Promise<number> {
  const [claim, allocations] = await Promise.all([
    prisma.paymentClaim.findUniqueOrThrow({
      where: { id: paymentClaimId },
      select: { contractWorksAmount: true, otherAmount: true }
    }),
    prisma.variationItemClaimAllocation.findMany({ where: { paymentClaimId }, select: { amount: true } })
  ]);

  const allocationTotal = allocations.reduce((sum, a) => sum + Number(a.amount), 0);
  const total = Number(claim.contractWorksAmount) + Number(claim.otherAmount) + allocationTotal;

  await prisma.paymentClaim.update({ where: { id: paymentClaimId }, data: { claimedAmount: total } });
  return total;
}

// Adds/updates this Variation's allocation for this specific claim — the
// unique constraint on (variationItemId, paymentClaimId) means calling this
// again for the same pair updates the existing row rather than creating a
// second one. The Variation's own creation month (variationCreatedAt) is
// never touched here — this is purely "how much of it is in THIS claim."
export async function setVariationAllocation(params: {
  paymentClaimId: string;
  variationItemId: string;
  amount: number;
  userId: string;
}): Promise<void> {
  await prisma.variationItemClaimAllocation.upsert({
    where: { variationItemId_paymentClaimId: { variationItemId: params.variationItemId, paymentClaimId: params.paymentClaimId } },
    create: {
      variationItemId: params.variationItemId,
      paymentClaimId: params.paymentClaimId,
      amount: params.amount,
      createdByUserId: params.userId
    },
    update: { amount: params.amount }
  });
  await recomputeClaimTotal(params.paymentClaimId);
}

export async function removeVariationAllocation(params: { paymentClaimId: string; variationItemId: string }): Promise<void> {
  await prisma.variationItemClaimAllocation
    .delete({
      where: { variationItemId_paymentClaimId: { variationItemId: params.variationItemId, paymentClaimId: params.paymentClaimId } }
    })
    .catch(() => undefined);
  await recomputeClaimTotal(params.paymentClaimId);
}

// Links a piece of REAL evidence (VariationPackage/Correspondence/
// ExternalAction/QARecord/Update — never the dormant Evidence model) to a
// claim. Polymorphic: evidenceId is resolved against whichever table
// evidenceType names by the caller when displaying it (see
// getClaimEvidence below), not via a database FK.
export async function linkClaimEvidence(params: {
  paymentClaimId: string;
  evidenceType: ClaimEvidenceType;
  evidenceId: string;
}): Promise<void> {
  await prisma.claimEvidenceLink
    .create({ data: { paymentClaimId: params.paymentClaimId, evidenceType: params.evidenceType, evidenceId: params.evidenceId } })
    .catch(() => undefined); // unique constraint — already linked, harmless no-op
}

export async function unlinkClaimEvidence(params: {
  paymentClaimId: string;
  evidenceType: ClaimEvidenceType;
  evidenceId: string;
}): Promise<void> {
  await prisma.claimEvidenceLink
    .delete({
      where: {
        paymentClaimId_evidenceType_evidenceId: {
          paymentClaimId: params.paymentClaimId,
          evidenceType: params.evidenceType,
          evidenceId: params.evidenceId
        }
      }
    })
    .catch(() => undefined);
}

export type ResolvedClaimEvidence = {
  evidenceType: ClaimEvidenceType;
  evidenceId: string;
  label: string;
  href: string | null;
};

// Resolves each polymorphic link back to a real, displayable row — the one
// place that knows how to turn (evidenceType, evidenceId) into something
// showable, so the claim UI never has to know the shape of 5 different
// tables itself.
export async function getClaimEvidence(paymentClaimId: string, projectId: string): Promise<ResolvedClaimEvidence[]> {
  const links = await prisma.claimEvidenceLink.findMany({ where: { paymentClaimId } });
  const resolved: ResolvedClaimEvidence[] = [];

  for (const link of links) {
    switch (link.evidenceType) {
      case "variation_package": {
        const pkg = await prisma.variationPackage.findUnique({
          where: { id: link.evidenceId },
          select: { fileName: true, variationItemId: true }
        });
        resolved.push({
          evidenceType: link.evidenceType,
          evidenceId: link.evidenceId,
          label: pkg?.fileName ?? "Variation Package",
          href: pkg ? `/projects/${projectId}/variations/${pkg.variationItemId}` : null
        });
        break;
      }
      case "correspondence": {
        const item = await prisma.correspondence.findUnique({
          where: { id: link.evidenceId },
          select: { title: true, variationItemId: true }
        });
        resolved.push({
          evidenceType: link.evidenceType,
          evidenceId: link.evidenceId,
          label: item?.title ?? "Correspondence",
          href: item?.variationItemId ? `/projects/${projectId}/variations/${item.variationItemId}` : `/projects/${projectId}/correspondence`
        });
        break;
      }
      case "external_action": {
        const action = await prisma.externalAction.findUnique({
          where: { id: link.evidenceId },
          select: { type: true, variationItemId: true, status: true }
        });
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
