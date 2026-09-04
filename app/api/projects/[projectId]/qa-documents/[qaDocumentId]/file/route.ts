import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { getSignedDownloadUrl } from "@/lib/s3";

// A QaDocument is an immutable snapshot once generated (same reasoning as
// VariationPackage) — this redirects to the STORED file, unlike Payment
// Claim's own .../pdf route, which deliberately regenerates fresh every
// time because a claim's underlying numbers can still change.
export async function GET(request: Request, context: { params: { projectId: string; qaDocumentId: string } }) {
  const userId = await requireUserId(request);
  const { projectId, qaDocumentId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const canAccessModule = await requireModuleAccess(projectId, userId, "quality_assurance");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const qaDocument = await prisma.qaDocument.findFirst({ where: { id: qaDocumentId, projectId } });
  if (!qaDocument) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const signedUrl = await getSignedDownloadUrl(qaDocument.storageKey);
  return NextResponse.redirect(signedUrl);
}
