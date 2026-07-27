import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, requireUserId } from "@/lib/auth";
import { getSignedDownloadUrl } from "@/lib/s3";

export async function GET(
  request: Request,
  context: { params: { projectId: string; siteInstructionId: string } }
) {
  const userId = await requireUserId(request);
  const { projectId, siteInstructionId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const siteInstruction = await prisma.siteInstruction.findFirst({
    where: { id: siteInstructionId, projectId }
  });

  if (!siteInstruction?.storageKey) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const signedUrl = await getSignedDownloadUrl(siteInstruction.storageKey);

  return NextResponse.redirect(signedUrl);
}
