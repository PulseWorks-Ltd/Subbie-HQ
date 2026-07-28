import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { getSignedDownloadUrl } from "@/lib/s3";

export async function GET(
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

  // Reachable either from a Variation/SI detail page (gated by that item's own
  // module) or from the aggregated Pictures gallery (gated by the "pictures"
  // module) — either grants viewing the actual image.
  const item = await prisma.variationItem.findFirst({ where: { id: itemId, projectId }, select: { type: true } });
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const canViewViaItem = await requireModuleAccess(
    projectId,
    userId,
    item.type === "variation" ? "variations" : "site_instructions"
  );
  const canViewViaPictures = await requireModuleAccess(projectId, userId, "pictures");
  if (!canViewViaItem && !canViewViaPictures) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const photo = await prisma.variationPhoto.findFirst({ where: { id: photoId, variationItemId: itemId } });
  if (!photo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const signedUrl = await getSignedDownloadUrl(photo.storageKey);
  return NextResponse.redirect(signedUrl);
}
