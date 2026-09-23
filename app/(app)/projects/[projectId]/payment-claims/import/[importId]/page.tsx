import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/auth";
import { getPaymentClaimImport } from "@/lib/payment-claim-import";
import { getContractScheduleForProject } from "@/lib/contract-schedule";
import { PaymentClaimImportReviewView } from "@/components/payment-claims/payment-claim-import-review-view";

export default async function PaymentClaimImportReviewPage({
  params
}: {
  params: Promise<{ projectId: string; importId: string }>;
}) {
  const { projectId, importId } = await params;

  const session = await auth();
  const userId = session?.user?.id;
  const canAccess = userId ? await requireModuleAccess(projectId, userId, "payment_claims") : false;
  if (!canAccess) {
    redirect(`/projects/${projectId}`);
  }

  const importRecord = await getPaymentClaimImport(importId);
  if (!importRecord || importRecord.projectId !== projectId) {
    notFound();
  }

  const [project, contractTerms, schedule, variationCandidates] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { name: true } }),
    prisma.contractTerms.findUnique({ where: { projectId }, select: { retentionPercent: true } }),
    getContractScheduleForProject(projectId),
    prisma.variationItem.findMany({
      where: { projectId },
      select: { id: true, reference: true, title: true, closedAt: true },
      orderBy: { reference: "asc" }
    })
  ]);

  const contractItemCandidates = (schedule?.items ?? []).map((item) => ({ id: item.id, description: item.description }));

  return (
    <PaymentClaimImportReviewView
      projectId={projectId}
      projectName={project?.name ?? ""}
      retentionPercent={contractTerms?.retentionPercent ?? null}
      contractItemCandidates={contractItemCandidates}
      variationCandidates={variationCandidates.map((v) => ({
        id: v.id,
        reference: v.reference,
        title: v.title,
        closed: v.closedAt != null
      }))}
      importRecord={{
        id: importRecord.id,
        status: importRecord.status,
        fileName: importRecord.fileName,
        aiConfidence: importRecord.aiConfidence,
        aiNotes: importRecord.aiNotes,
        externalClaimReference: importRecord.externalClaimReference,
        externalClaimNumber: importRecord.externalClaimNumber,
        claimDate: importRecord.claimDate?.toISOString() ?? null,
        periodStart: importRecord.periodStart?.toISOString() ?? null,
        periodEnd: importRecord.periodEnd?.toISOString() ?? null,
        projectNameOnDocument: importRecord.projectNameOnDocument,
        projectReferenceOnDocument: importRecord.projectReferenceOnDocument,
        contractReferenceOnDocument: importRecord.contractReferenceOnDocument,
        originalContractSum: importRecord.originalContractSum != null ? Number(importRecord.originalContractSum) : null,
        approvedVariationsTotal: importRecord.approvedVariationsTotal != null ? Number(importRecord.approvedVariationsTotal) : null,
        revisedContractSum: importRecord.revisedContractSum != null ? Number(importRecord.revisedContractSum) : null,
        pendingVariationsTotal: importRecord.pendingVariationsTotal != null ? Number(importRecord.pendingVariationsTotal) : null,
        grossClaimToDate: importRecord.grossClaimToDate != null ? Number(importRecord.grossClaimToDate) : null,
        retentionPercentStated: importRecord.retentionPercentStated,
        retentionToDateStated: importRecord.retentionToDateStated != null ? Number(importRecord.retentionToDateStated) : null,
        netClaimToDate: importRecord.netClaimToDate != null ? Number(importRecord.netClaimToDate) : null,
        previousClaimsTotal: importRecord.previousClaimsTotal != null ? Number(importRecord.previousClaimsTotal) : null,
        currentClaimAmount: importRecord.currentClaimAmount != null ? Number(importRecord.currentClaimAmount) : null,
        baselineDate: importRecord.baselineDate?.toISOString() ?? null,
        arithmeticWarning: importRecord.arithmeticWarning,
        resultingPaymentClaimId: importRecord.resultingPaymentClaimId,
        items: importRecord.items.map((item) => ({
          id: item.id,
          reference: item.reference,
          description: item.description,
          contractValue: item.contractValue != null ? Number(item.contractValue) : null,
          revisedValue: item.revisedValue != null ? Number(item.revisedValue) : null,
          claimedPercentToDate: item.claimedPercentToDate,
          claimedAmountToDate: item.claimedAmountToDate != null ? Number(item.claimedAmountToDate) : null,
          currentPeriodAmount: item.currentPeriodAmount != null ? Number(item.currentPeriodAmount) : null,
          matchStatus: item.matchStatus,
          matchedContractItemId: item.matchedContractItemId,
          matchReason: item.matchReason,
          conflictNote: item.conflictNote,
          userAction: item.userAction
        })),
        variations: importRecord.variations.map((variation) => ({
          id: variation.id,
          reference: variation.reference,
          description: variation.description,
          submittedValue: variation.submittedValue != null ? Number(variation.submittedValue) : null,
          approvedValue: variation.approvedValue != null ? Number(variation.approvedValue) : null,
          claimedPercentToDate: variation.claimedPercentToDate,
          claimedAmountToDate: variation.claimedAmountToDate != null ? Number(variation.claimedAmountToDate) : null,
          currentPeriodAmount: variation.currentPeriodAmount != null ? Number(variation.currentPeriodAmount) : null,
          approvalStatusRaw: variation.approvalStatusRaw,
          matchStatus: variation.matchStatus,
          matchedVariationItemId: variation.matchedVariationItemId,
          matchReason: variation.matchReason,
          conflictNote: variation.conflictNote,
          existingRecordClosed: variation.existingRecordClosed,
          userAction: variation.userAction
        }))
      }}
    />
  );
}
