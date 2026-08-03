import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { deleteFromS3 } from "@/lib/s3";

export async function DELETE(
  request: Request,
  context: { params: { projectId: string; itemId: string; sheetId: string; plantId: string } }
) {
  const userId = await requireUserId(request);
  const { projectId, itemId, sheetId, plantId } = context.params;
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

  const plant = await prisma.dayWorksPlant.findFirst({
    where: { id: plantId, dayWorksSheetId: sheetId, dayWorksSheet: { variationItemId: itemId } }
  });
  if (plant) {
    if (plant.photoStorageKey) {
      await deleteFromS3(plant.photoStorageKey).catch(() => {});
    }
    await prisma.dayWorksPlant.delete({ where: { id: plantId } });
  }

  return NextResponse.json({ ok: true });
}
