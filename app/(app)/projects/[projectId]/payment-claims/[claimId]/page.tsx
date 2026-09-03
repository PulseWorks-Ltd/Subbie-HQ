import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/auth";
import { getContractScheduleForProject, computeScheduleClaimBreakdown, computeScheduleTotalValue, sumBreakdown } from "@/lib/contract-schedule";
import { PaymentClaimDetailView } from "@/components/payment-claims/payment-claim-detail-view";

export default async function PaymentClaimDetailPage({
  params
}: {
  params: Promise<{ projectId: string; claimId: string }>;
}) {
  const { projectId, claimId } = await params;

  const session = await auth();
  const userId = session?.user?.id;
  const canAccess = userId ? await requireModuleAccess(projectId, userId, "payment_claims") : false;
  if (!canAccess) {
    redirect(`/projects/${projectId}`);
  }

  const claim = await prisma.paymentClaim.findFirst({
    where: { id: claimId, projectId },
    include: { allocations: { include: { variationItem: true } } }
  });
  if (!claim) notFound();

  // The immediately-prior claim (by period, not creation order) — the same
  // cutoff computeScheduleClaimBreakdown uses to work out what's genuinely
  // NEW in this claim versus already claimed before it.
  const previousClaim = await prisma.paymentClaim.findFirst({
    where: { projectId, periodEnd: { lt: claim.periodStart } },
    orderBy: { periodEnd: "desc" }
  });

  const [schedule, contractTerms, eligibleVariations] = await Promise.all([
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
    })
  ]);

  const breakdown = schedule
    ? computeScheduleClaimBreakdown(schedule, claim.periodStart, claim.periodEnd, previousClaim?.periodEnd ?? null)
    : [];
  const scheduleTotals = sumBreakdown(breakdown);
  const originalSubcontractSum = schedule ? computeScheduleTotalValue(schedule) : 0;

  const variationsForClaim = eligibleVariations.map((item) => {
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

  return (
    <PaymentClaimDetailView
      projectId={projectId}
      claim={{
        id: claim.id,
        claimNumber: claim.claimNumber,
        status: claim.status,
        periodStart: claim.periodStart.toISOString(),
        periodEnd: claim.periodEnd.toISOString(),
        referenceDate: claim.referenceDate.toISOString(),
        statutoryWording: claim.statutoryWording,
        contractWorksAmount: Number(claim.contractWorksAmount),
        otherAmount: Number(claim.otherAmount),
        claimedAmount: Number(claim.claimedAmount)
      }}
      hasSchedule={Boolean(schedule)}
      originalSubcontractSum={originalSubcontractSum}
      scheduleBreakdown={breakdown}
      scheduleClaimedToDate={scheduleTotals.claimedToDate}
      scheduleThisClaim={scheduleTotals.thisClaim}
      retentionPercent={contractTerms?.retentionPercent ?? 5}
      variations={variationsForClaim}
    />
  );
}
