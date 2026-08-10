import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";

export async function DELETE(
  request: Request,
  context: { params: { projectId: string; itemId: string; recordId: string } }
) {
  const userId = await requireUserId(request);
  const { projectId, itemId, recordId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const item = await prisma.variationItem.findFirst({ where: { id: itemId, projectId }, select: { type: true } });
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const canAccessModule = await requireModuleAccess(
    projectId,
    userId,
    item.type === "variation" ? "variations" : "site_instructions"
  );
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Works regardless of whether this record came from AI extraction (has
  // a dayWorksSheetId) or manual entry (doesn't) — deleting a labour
  // record here never touches its source sheet/file, if it has one.
  await prisma.dayWorksSheetRecord.deleteMany({ where: { id: recordId, variationItemId: itemId } });

  return NextResponse.json({ ok: true });
}
