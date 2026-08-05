import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { deleteFromS3 } from "@/lib/s3";

export async function DELETE(
  request: Request,
  context: { params: { projectId: string; itemId: string; photoId: string } }
) {
  const userId = await requireUserId(request);
  const { projectId, itemId, photoId } = context.params;
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

  const photo = await prisma.variationPhoto.findFirst({ where: { id: photoId, variationItemId: itemId } });
  if (photo) {
    await deleteFromS3(photo.storageKey).catch(() => {});
    if (photo.thumbnailStorageKey) {
      await deleteFromS3(photo.thumbnailStorageKey).catch(() => {});
    }
    await prisma.variationPhoto.delete({ where: { id: photoId } });
  }

  return NextResponse.json({ ok: true });
}
