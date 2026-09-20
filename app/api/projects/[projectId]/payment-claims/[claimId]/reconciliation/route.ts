import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { getReconciliationHistory, createManualReconciliation } from "@/lib/payment-reconciliation";

async function loadClaim(projectId: string, claimId: string) {
  return prisma.paymentClaim.findFirst({ where: { id: claimId, projectId }, select: { id: true, status: true } });
}

export async function GET(request: Request, context: { params: { projectId: string; claimId: string } }) {
  const userId = await requireUserId(request);
  const { projectId, claimId } = context.params;
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

  const claim = await loadClaim(projectId, claimId);
  if (!claim) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const history = await getReconciliationHistory(claimId);
  return NextResponse.json({ history });
}

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

const manualReconciliationSchema = z.object({
  claimedAmount: z.number().nonnegative(),
  certifiedAmount: z.number().nonnegative(),
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

// The manual "Record contractor response" action — always goes straight
// to a confirmed ContractorPaymentSchedule (Section 12 of the spec this
// implements): the person typing the numbers in IS the review step.
export async function POST(request: Request, context: { params: { projectId: string; claimId: string } }) {
  const userId = await requireUserId(request);
  const { projectId, claimId } = context.params;
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

  const claim = await loadClaim(projectId, claimId);
  if (!claim) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // A claim that hasn't been sent yet has nothing to reconcile against —
  // matches Section 11's "available for issued/responded claims."
  if (claim.status === "draft") {
    return NextResponse.json({ error: "This claim hasn't been sent yet — there's nothing to record a response against." }, { status: 409 });
  }

  const parsed = manualReconciliationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const payload = parsed.data;

  const schedule = await createManualReconciliation({
    paymentClaimId: claimId,
    userId,
    claimedAmount: payload.claimedAmount,
    certifiedAmount: payload.certifiedAmount,
    declineLines: payload.declineLines,
    statedRetentionAmount: payload.statedRetentionAmount ?? null,
    adjustments: payload.adjustments,
    receivedAmount: payload.receivedAmount ?? null,
    paymentDueDate: parseNullableDate(payload.paymentDueDate),
    paymentReceivedDate: parseNullableDate(payload.paymentReceivedDate)
  });

  return NextResponse.json({ schedule }, { status: 201 });
}
