import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { getSignedDownloadUrl } from "@/lib/s3";

export async function GET(
  request: Request,
  context: { params: { projectId: string; itemId: string; sheetId: string; materialId: string } }
) {
  const userId = await requireUserId(request);
  const { projectId, itemId, sheetId, materialId } = context.params;
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
    where: { id: materialId, dayWorksSheetId: sheetId, dayWorksSheet: { variationItemId: itemId } }
  });
  if (!material || !material.photoStorageKey) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const signedUrl = await getSignedDownloadUrl(material.photoStorageKey);
  return NextResponse.redirect(signedUrl);
}
