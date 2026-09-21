import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { setImportItemAction } from "@/lib/payment-claim-import";

const bodySchema = z.object({
  userAction: z.enum(["pending", "accept_match", "create_new", "ignore"]),
  matchedContractItemId: z.string().nullable().optional()
});

// A user override on the review screen (Section 31) — e.g. picking a
// different existing ContractItem than the one auto-proposed, or
// explicitly saying "don't import this item."
export async function PATCH(
  request: Request,
  context: { params: { projectId: string; importId: string; itemId: string } }
) {
  const userId = await requireUserId(request);
  const { projectId, importId, itemId } = context.params;
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

  const item = await prisma.paymentClaimImportItem.findFirst({
    where: { id: itemId, paymentClaimImportId: importId, paymentClaimImport: { projectId } }
  });
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    await setImportItemAction({ itemId, userAction: parsed.data.userAction, matchedContractItemId: parsed.data.matchedContractItemId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save this change." }, { status: 409 });
  }
}
