import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";

async function moduleForItem(projectId: string, itemId: string) {
  const item = await prisma.variationItem.findFirst({ where: { id: itemId, projectId }, select: { type: true } });
  if (!item) return null;
  return item.type === "variation" ? ("variations" as const) : ("site_instructions" as const);
}

// Unlinks only — detaches this correspondence from this Variation/SI by
// clearing variationItemId, never deletes the Correspondence row itself.
// Deliberately a separate route from the main Correspondence tab's DELETE
// (app/api/projects/[projectId]/correspondence/[id]/route.ts), which is
// genuine permanent deletion — correspondence often represents a real
// record of what was sent to a Main Contractor, so an action taken from
// an SI/Variation page must never destroy it, only its tag.
export async function DELETE(
  request: Request,
  context: { params: { projectId: string; itemId: string; correspondenceId: string } }
) {
  const userId = await requireUserId(request);
  const { projectId, itemId, correspondenceId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const module_ = await moduleForItem(projectId, itemId);
  if (!module_) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const canAccessModule = await requireModuleAccess(projectId, userId, module_);
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const correspondence = await prisma.correspondence.findFirst({
    where: { id: correspondenceId, variationItemId: itemId, projectId }
  });
  if (!correspondence) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.correspondence.update({ where: { id: correspondenceId }, data: { variationItemId: null } });

  return NextResponse.json({ ok: true });
}
