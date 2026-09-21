import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/auth";
import { getPaymentClaimComputedData } from "@/lib/payment-claim";
import { getReconciliationHistory, getOpenDeclineLinesForProject } from "@/lib/payment-reconciliation";
import { computeTotalRetentionWithheld } from "@/lib/retention";
import { PaymentClaimDetailView } from "@/components/payment-claims/payment-claim-detail-view";
import type { SerializedReconciliation } from "@/components/payment-claims/contractor-response-section";
import type { OpenDeclineLineView } from "@/components/payment-claims/previous-declines-panel";

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

  const [reconciliationHistory, calculatedRetention] = await Promise.all([
    getReconciliationHistory(claimId),
    computeTotalRetentionWithheld(projectId)
  ]);

  // Task 4 — only worth querying (and only ever actionable) on a claim
  // that hasn't been sent yet; an issued/responded claim's own figures are
  // fixed, so carrying an old decline into it would misrepresent what was
  // actually submitted. See PreviousDeclinesPanel/carryForwardDeclineLine.
  const openDeclineLinesRaw = data.claim.status === "draft" ? await getOpenDeclineLinesForProject(projectId, claimId) : [];
  const variationLabelById = new Map(data.variations.map((v) => [v.id, `${v.reference} — ${v.title}`]));
  const openDeclineLines: OpenDeclineLineView[] = openDeclineLinesRaw.map((line) => ({
    id: line.id,
    paymentClaimId: line.paymentClaimId,
    claimNumber: line.claimNumber,
    description: line.description,
    amount: Number(line.amount),
    reason: line.reason,
    variationItemId: line.variationItemId,
    variationLabel: line.variationItemId ? (variationLabelById.get(line.variationItemId) ?? "Linked Variation/SI") : null
  }));

  // Just for resolving a resolved decline line's resolvedInClaimId back to
  // a human-readable claim number in the display below — never used for
  // any calculation.
  const allClaimNumbersById = new Map(
    (await prisma.paymentClaim.findMany({ where: { projectId }, select: { id: true, claimNumber: true } })).map((c) => [
      c.id,
      c.claimNumber
    ])
  );

  const serializedHistory: SerializedReconciliation[] = reconciliationHistory.map((schedule) => ({
    id: schedule.id,
    source: schedule.source,
    status: schedule.status,
    claimedAmount: schedule.claimedAmount != null ? Number(schedule.claimedAmount) : null,
    certifiedAmount: schedule.certifiedAmount != null ? Number(schedule.certifiedAmount) : null,
    declinedAmount: Number(schedule.declinedAmount),
    statedRetentionAmount: schedule.statedRetentionAmount != null ? Number(schedule.statedRetentionAmount) : null,
    receivedAmount: schedule.receivedAmount != null ? Number(schedule.receivedAmount) : null,
    paymentDueDate: schedule.paymentDueDate ? schedule.paymentDueDate.toISOString() : null,
    paymentReceivedDate: schedule.paymentReceivedDate ? schedule.paymentReceivedDate.toISOString() : null,
    fileName: schedule.fileName,
    aiConfidence: schedule.aiConfidence,
    aiNotes: schedule.aiNotes,
    confirmedAt: schedule.confirmedAt ? schedule.confirmedAt.toISOString() : null,
    createdAt: schedule.createdAt.toISOString(),
    declineLines: schedule.declineLines.map((line) => ({
      id: line.id,
      description: line.description,
      amount: Number(line.amount),
      reason: line.reason,
      variationItemId: line.variationItemId,
      resolution: line.resolution,
      resolvedInClaimNumber: line.resolvedInClaimId ? (allClaimNumbersById.get(line.resolvedInClaimId) ?? null) : null
    })),
    adjustments: schedule.adjustments.map((adjustment) => ({
      id: adjustment.id,
      description: adjustment.description,
      amount: Number(adjustment.amount)
    }))
  }));

  return (
    <PaymentClaimDetailView
      projectId={projectId}
      contacts={contacts}
      reconciliationHistory={serializedHistory}
      calculatedRetention={calculatedRetention}
      openDeclineLines={openDeclineLines}
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
        claimedAmount: data.claim.claimedAmount,
        source: data.claim.source,
        externalReference: data.claim.externalReference
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
