import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { getSignedDownloadUrl } from "@/lib/s3";

export async function GET(
  request: Request,
  context: { params: { projectId: string; attachmentId: string } }
) {
  const userId = await requireUserId(request);
  const { projectId, attachmentId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const canAccessModule = await requireModuleAccess(projectId, userId, "updates");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const attachment = await prisma.updateAttachment.findFirst({
    where: { id: attachmentId, update: { projectId } }
  });

  if (!attachment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // ?variant=thumbnail serves the small generated display copy when one
  // exists (see lib/image-thumbnails.ts) — falls back to the original for
  // non-image attachments, pre-thumbnail-feature rows, or a generation
  // failure at upload time, so this never 404s just because no derivative
  // was ever made. The original itself is never affected either way.
  const wantsThumbnail = new URL(request.url).searchParams.get("variant") === "thumbnail";
  const key = wantsThumbnail && attachment.thumbnailStorageKey ? attachment.thumbnailStorageKey : attachment.storageKey;

  const signedUrl = await getSignedDownloadUrl(key);

  return NextResponse.redirect(signedUrl);
}
