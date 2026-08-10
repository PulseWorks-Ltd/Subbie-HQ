import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { deleteFromS3 } from "@/lib/s3";

export async function DELETE(
  request: Request,
  context: { params: { projectId: string; itemId: string; sheetId: string } }
) {
  const userId = await requireUserId(request);
  const { projectId, itemId, sheetId } = context.params;
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

  // Materials/plant are independent of any sheet now (Labour, Plant &
  // Material AI Extraction) — dayWorksSheetId is only a nullable
  // historical reference (onDelete: SetNull), so deleting a sheet no
  // longer deletes them, only clears that reference. Only the sheet's
  // own file and labour records (sheetRecords, onDelete: Cascade) go.
  const sheet = await prisma.dayWorksSheet.findFirst({ where: { id: sheetId, variationItemId: itemId } });
  if (sheet) {
    await deleteFromS3(sheet.storageKey).catch(() => {});
    await prisma.dayWorksSheet.delete({ where: { id: sheetId } });
  }

  return NextResponse.json({ ok: true });
}
