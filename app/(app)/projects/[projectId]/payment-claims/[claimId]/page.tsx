import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/auth";
import { getPaymentClaimComputedData } from "@/lib/payment-claim";
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

  // Pre-Launch Feature 5 — this same computation now also backs the
  // Payment Claim PDF generator (lib/payment-claim-pdf.ts), so the two can
  // never disagree about what a claim is actually worth.
  const data = await getPaymentClaimComputedData(projectId, claimId);
  if (!data) notFound();

  // Pre-Launch Feature 5 — same contact source as the Updates external-send
  // flow (MainContractorContact scoped to this project's Main Contractor).
  const contacts = data.mainContractorId
    ? await prisma.mainContractorContact.findMany({
        where: { mainContractorId: data.mainContractorId },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: "asc" }
      })
    : [];

  return (
    <PaymentClaimDetailView
      projectId={projectId}
      contacts={contacts}
      claim={{
        id: data.claim.id,
        claimNumber: data.claim.claimNumber,
        status: data.claim.status,
        periodStart: data.claim.periodStart.toISOString(),
        periodEnd: data.claim.periodEnd.toISOString(),
        referenceDate: data.claim.referenceDate.toISOString(),
        statutoryWording: data.claim.statutoryWording,
        contractWorksAmount: data.claim.contractWorksAmount,
        otherAmount: data.claim.otherAmount,
        claimedAmount: data.claim.claimedAmount
      }}
      hasSchedule={data.hasSchedule}
      originalSubcontractSum={data.figures.originalSubcontractSum}
      scheduleBreakdown={data.scheduleBreakdown}
      scheduleClaimedToDate={data.figures.scheduleClaimedToDate}
      scheduleThisClaim={data.figures.scheduleThisClaim}
      retentionPercent={data.retentionPercent}
      variations={data.variations}
      approvedVariationsTotal={data.figures.approvedVariationsTotal}
    />
  );
}
