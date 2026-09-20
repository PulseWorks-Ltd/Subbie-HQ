import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { confirmReconciliation } from "@/lib/payment-reconciliation";

// The only action that moves draft -> confirmed (Section 19 of the spec
// this implements). Also the point where the first confirmation against
// an `issued` claim flips PaymentClaim.status to `responded` — see
// lib/payment-reconciliation.ts's markClaimRespondedIfFirstConfirmation.
export async function POST(
  request: Request,
  context: { params: { projectId: string; claimId: string; reconciliationId: string } }
) {
  const userId = await requireUserId(request);
  const { projectId, claimId, reconciliationId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const canAccessModule = await requireModuleAccess(projectId, userId, "payment_claims");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const schedule = await prisma.contractorPaymentSchedule.findFirst({
    where: { id: reconciliationId, paymentClaimId: claimId, paymentClaim: { projectId } }
  });
  if (!schedule) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const confirmed = await confirmReconciliation(reconciliationId, userId);
    return NextResponse.json({ schedule: confirmed });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not confirm this response." }, { status: 409 });
  }
}
