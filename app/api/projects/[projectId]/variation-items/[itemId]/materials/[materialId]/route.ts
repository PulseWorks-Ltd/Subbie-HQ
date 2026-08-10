import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { deleteFromS3 } from "@/lib/s3";

export async function DELETE(
  request: Request,
  context: { params: { projectId: string; itemId: string; materialId: string } }
) {
  const userId = await requireUserId(request);
  const { projectId, itemId, materialId } = context.params;
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

  const material = await prisma.dayWorksMaterial.findFirst({
    where: { id: materialId, variationItemId: itemId }
  });
  if (material) {
    // A single uploaded materials invoice can extract into several line
    // items that all reference the SAME photoStorageKey (Labour, Plant &
    // Material AI Extraction's save step attaches the one source image to
    // every line item it produced) — only delete the S3 object once no
    // other row still points at it, otherwise deleting this row would
    // silently break the "Receipt" link on its siblings.
    if (material.photoStorageKey) {
      const stillReferenced = await prisma.dayWorksMaterial.findFirst({
        where: { photoStorageKey: material.photoStorageKey, id: { not: materialId } },
        select: { id: true }
      });
      if (!stillReferenced) {
        await deleteFromS3(material.photoStorageKey).catch(() => {});
      }
    }
    await prisma.dayWorksMaterial.delete({ where: { id: materialId } });
  }

  return NextResponse.json({ ok: true });
}
