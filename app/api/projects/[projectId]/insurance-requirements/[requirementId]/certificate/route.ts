import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { getSignedDownloadUrl } from "@/lib/s3";

export async function GET(
  request: Request,
  context: { params: { projectId: string; requirementId: string } }
) {
  const userId = await requireUserId(request);
  const { projectId, requirementId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const canAccessModule = await requireModuleAccess(projectId, userId, "insurance");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const insuranceRequirement = await prisma.insuranceRequirement.findFirst({ where: { id: requirementId, projectId } });
  if (!insuranceRequirement?.certificateStorageKey) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const signedUrl = await getSignedDownloadUrl(insuranceRequirement.certificateStorageKey);

  return NextResponse.redirect(signedUrl);
}
