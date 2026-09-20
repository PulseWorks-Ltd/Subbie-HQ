import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { updateDraftReconciliation } from "@/lib/payment-reconciliation";

const declineLineSchema = z.object({
  description: z.string().min(1),
  amount: z.number().nonnegative(),
  reason: z.string().min(1),
  variationItemId: z.string().nullable().optional()
});

const adjustmentSchema = z.object({
  description: z.string().min(1),
  amount: z.number()
});

const updateSchema = z.object({
  claimedAmount: z.number().nonnegative().nullable(),
  certifiedAmount: z.number().nonnegative().nullable(),
  declineLines: z.array(declineLineSchema).default([]),
  statedRetentionAmount: z.number().nonnegative().nullable().optional(),
  adjustments: z.array(adjustmentSchema).default([]),
  receivedAmount: z.number().nonnegative().nullable().optional(),
  paymentDueDate: z.string().nullable().optional(),
  paymentReceivedDate: z.string().nullable().optional()
});

function parseNullableDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Edits a DRAFT response only — a confirmed one is immutable (Section 19).
// updateDraftReconciliation itself re-checks status too, so this can never
// silently mutate a confirmed commercial record even if a caller bypassed
// this route's own intent.
export async function PATCH(
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

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const payload = parsed.data;

  try {
    const updated = await updateDraftReconciliation(reconciliationId, {
      claimedAmount: payload.claimedAmount,
      certifiedAmount: payload.certifiedAmount,
      declineLines: payload.declineLines,
      statedRetentionAmount: payload.statedRetentionAmount ?? null,
      adjustments: payload.adjustments,
      receivedAmount: payload.receivedAmount ?? null,
      paymentDueDate: parseNullableDate(payload.paymentDueDate),
      paymentReceivedDate: parseNullableDate(payload.paymentReceivedDate)
    });
    return NextResponse.json({ schedule: updated });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save this response." }, { status: 409 });
  }
}
