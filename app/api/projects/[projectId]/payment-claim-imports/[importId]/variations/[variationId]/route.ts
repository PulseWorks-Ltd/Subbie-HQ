import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { setImportVariationAction } from "@/lib/payment-claim-import";

const bodySchema = z.object({
  userAction: z.enum(["pending", "match_existing", "create_new", "update_existing", "reactivate_and_update", "ignore"]),
  matchedVariationItemId: z.string().nullable().optional()
});

export async function PATCH(
  request: Request,
  context: { params: { projectId: string; importId: string; variationId: string } }
) {
  const userId = await requireUserId(request);
  const { projectId, importId, variationId } = context.params;
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

  const variation = await prisma.paymentClaimImportVariation.findFirst({
    where: { id: variationId, paymentClaimImportId: importId, paymentClaimImport: { projectId } }
  });
  if (!variation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // A closed record can only ever be touched via the explicit
  // reactivate_and_update action (Section 13) — never bypassed by picking
  // a different action that would otherwise silently update it.
  if (variation.existingRecordClosed && parsed.data.userAction === "update_existing") {
    return NextResponse.json(
      { error: "This record is closed — choose \"Reactivate & Update\" to make changes to it." },
      { status: 409 }
    );
  }

  try {
    await setImportVariationAction({
      variationId,
      userAction: parsed.data.userAction,
      matchedVariationItemId: parsed.data.matchedVariationItemId
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save this change." }, { status: 409 });
  }
}
