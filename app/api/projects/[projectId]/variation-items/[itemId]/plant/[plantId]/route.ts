import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { deleteFromS3 } from "@/lib/s3";

export async function DELETE(
  request: Request,
  context: { params: { projectId: string; itemId: string; plantId: string } }
) {
  const userId = await requireUserId(request);
  const { projectId, itemId, plantId } = context.params;
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

  const plantItem = await prisma.dayWorksPlant.findFirst({
    where: { id: plantId, variationItemId: itemId }
  });
  if (plantItem) {
    // Same shared-photo guard as materials/[materialId]/route.ts — a
    // single uploaded plant docket can extract into several line items
    // that all reference the same photoStorageKey.
    if (plantItem.photoStorageKey) {
      const stillReferenced = await prisma.dayWorksPlant.findFirst({
        where: { photoStorageKey: plantItem.photoStorageKey, id: { not: plantId } },
        select: { id: true }
      });
      if (!stillReferenced) {
        await deleteFromS3(plantItem.photoStorageKey).catch(() => {});
      }
    }
    await prisma.dayWorksPlant.delete({ where: { id: plantId } });
  }

  return NextResponse.json({ ok: true });
}
