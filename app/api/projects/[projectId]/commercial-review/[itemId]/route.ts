import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, requireUserId } from "@/lib/auth";
import { getOrganisationMembership } from "@/lib/organisation";
import { markCommercialReviewNoActionRequired } from "@/lib/commercial-review";

const patchSchema = z.object({
  action: z.literal("no_action_required"),
  reason: z.string().optional()
});

// Gated to isAdmin, not the usual requireModuleAccess — Commercial Review
// has no per-module permission of its own yet (see the implementation
// plan's note: the Admin/Management/Site tiered role this really wants
// doesn't exist yet). An org-less legacy project counts as admin-visible
// too, matching how every other org-gated feature treats org-less
// projects as unrestricted.
export async function PATCH(request: Request, context: { params: { projectId: string; itemId: string } }) {
  const userId = await requireUserId(request);
  const { projectId, itemId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const membership = await getOrganisationMembership(userId);
  if (membership && !membership.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const item = await prisma.commercialReviewItem.findFirst({ where: { id: itemId, projectId } });
  if (!item) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 });
  }

  const payload = patchSchema.parse(await request.json());
  const result = await markCommercialReviewNoActionRequired(itemId, userId, payload.reason);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
