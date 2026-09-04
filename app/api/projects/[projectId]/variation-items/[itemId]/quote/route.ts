import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { deleteFromS3, uploadToS3 } from "@/lib/s3";
import { ALLOWED_ATTACHMENT_TYPES, MAX_ATTACHMENT_SIZE_BYTES, isAllowedAttachmentType } from "@/lib/update-attachments";

async function moduleForItem(projectId: string, itemId: string) {
  const item = await prisma.variationItem.findFirst({ where: { id: itemId, projectId }, select: { type: true } });
  if (!item) return null;
  return item.type === "variation" ? ("variations" as const) : ("site_instructions" as const);
}

export async function POST(request: Request, context: { params: { projectId: string; itemId: string } }) {
  const userId = await requireUserId(request);
  const { projectId, itemId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const module_ = await moduleForItem(projectId, itemId);
  if (!module_) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const canAccessModule = await requireModuleAccess(projectId, userId, module_);
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!file || !(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (!isAllowedAttachmentType(file.type)) {
    return NextResponse.json({ error: `File must be one of: ${ALLOWED_ATTACHMENT_TYPES.join(", ")}.` }, { status: 400 });
  }
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return NextResponse.json({ error: "File must be 20MB or smaller." }, { status: 400 });
  }

  const existing = await prisma.variationItem.findFirst({ where: { id: itemId, projectId } });
  if (existing?.quoteStorageKey) {
    await deleteFromS3(existing.quoteStorageKey).catch(() => {});
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const uploadKey = `projects/${projectId}/variation-items/${itemId}/quote/${Date.now()}-${file.name}`;
  const { storageKey } = await uploadToS3({ key: uploadKey, body: buffer, contentType: file.type || "application/octet-stream" });

  const variationItem = await prisma.variationItem.update({
    where: { id: itemId, projectId },
    data: { quoteFileName: file.name, quoteStorageKey: storageKey }
  });

  return NextResponse.json({ variationItem }, { status: 201 });
}

// Hard-deletes the underlying file — matches the POST handler's own
// existing precedent (a Replace upload already deletes the previous
// quote's S3 object outright, not just detaching the reference), so
// Remove behaves consistently with the replace flow's already-established
// treatment of quote files as disposable/replaceable rather than
// permanently retained.
export async function DELETE(request: Request, context: { params: { projectId: string; itemId: string } }) {
  const userId = await requireUserId(request);
  const { projectId, itemId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const module_ = await moduleForItem(projectId, itemId);
  if (!module_) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const canAccessModule = await requireModuleAccess(projectId, userId, module_);
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.variationItem.findFirst({ where: { id: itemId, projectId } });
  if (existing?.quoteStorageKey) {
    await deleteFromS3(existing.quoteStorageKey).catch(() => {});
  }

  const variationItem = await prisma.variationItem.update({
    where: { id: itemId, projectId },
    data: { quoteFileName: null, quoteStorageKey: null }
  });

  return NextResponse.json({ variationItem });
}
