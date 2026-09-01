import type { ClaimEvidenceType } from "@prisma/client";
import { prisma } from "./prisma";

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
