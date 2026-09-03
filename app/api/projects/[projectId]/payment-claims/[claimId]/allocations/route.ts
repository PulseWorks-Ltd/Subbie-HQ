import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { setVariationAllocation, removeVariationAllocation } from "@/lib/payment-claim";

const setSchema = z.object({ variationItemId: z.string(), amount: z.number() });

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

  const claim = await prisma.paymentClaim.findFirst({ where: { id: claimId, projectId } });
  if (!claim) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const payload = setSchema.parse(await request.json());
  const variationItem = await prisma.variationItem.findFirst({ where: { id: payload.variationItemId, projectId } });
  if (!variationItem) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (payload.amount <= 0) {
    await removeVariationAllocation({ paymentClaimId: claimId, variationItemId: payload.variationItemId });
  } else {
    await setVariationAllocation({ paymentClaimId: claimId, variationItemId: payload.variationItemId, amount: payload.amount, userId });
  }

  const updatedClaim = await prisma.paymentClaim.findUnique({ where: { id: claimId } });
  return NextResponse.json({ claim: updatedClaim });
}
