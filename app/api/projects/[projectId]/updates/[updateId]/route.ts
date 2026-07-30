import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";

const patchSchema = z.object({ variationItemId: z.string().nullable() });

// Lets a user tag (or change/clear the tag on) an already-posted Update —
// at compose time this can only be set once, but in practice which SI/
// Variation an Update belongs to often only becomes clear later. Top-level
// updates only, matching the existing rule that replies don't carry their
// own tag (they inherit whatever their parent thread is tagged to).
export async function PATCH(request: Request, context: { params: { projectId: string; updateId: string } }) {
  const userId = await requireUserId(request);
  const { projectId, updateId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const canAccessModule = await requireModuleAccess(projectId, userId, "updates");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const update = await prisma.update.findFirst({ where: { id: updateId, projectId } });
  if (!update) {
    return NextResponse.json({ error: "Update not found." }, { status: 404 });
  }
  if (update.parentId !== null) {
    return NextResponse.json({ error: "A reply can't carry its own tag — tag the original update instead." }, { status: 400 });
  }

  const payload = patchSchema.parse(await request.json());

  if (payload.variationItemId) {
    const item = await prisma.variationItem.findFirst({ where: { id: payload.variationItemId, projectId } });
    if (!item) {
      return NextResponse.json({ error: "Variation/Site Instruction not found." }, { status: 400 });
    }
  }

  const updated = await prisma.update.update({
    where: { id: updateId },
    data: { variationItemId: payload.variationItemId }
  });

  return NextResponse.json({ update: updated });
}
