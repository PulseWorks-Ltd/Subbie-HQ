import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { downloadFromS3, uploadToS3 } from "@/lib/s3";
import { ALLOWED_ATTACHMENT_TYPES, MAX_ATTACHMENT_SIZE_BYTES, isAllowedAttachmentType } from "@/lib/update-attachments";

async function moduleForItem(projectId: string, itemId: string) {
  const item = await prisma.variationItem.findFirst({ where: { id: itemId, projectId }, select: { type: true } });
  if (!item) return null;
  return item.type === "variation" ? ("variations" as const) : ("site_instructions" as const);
}

export async function GET(request: Request, context: { params: { projectId: string; itemId: string } }) {
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

  // Just the uploaded files — labour records are independent of any
  // sheet now too (Labour, Plant & Material AI Extraction, extended to
  // Labour), fetched at the item level instead (see
  // variation-items/[itemId]/labour-records, .../materials, .../plant).
  const dayWorksSheets = await prisma.dayWorksSheet.findMany({
    where: { variationItemId: itemId },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ dayWorksSheets });
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

  // Two input paths, same end result (a new DayWorksSheet row pointing at
  // its own S3 object): a fresh multipart upload (existing "+Upload"
  // button), or a JSON reference to an image that's already stored
  // elsewhere in this project (the "Use as Day Works Sheet" action on an
  // Update attachment or a Pictures-tab photo — see
  // components/day-works/use-as-day-works-sheet-action.tsx). The second
  // path always copies the bytes to a brand-new key rather than reusing
  // the source's storageKey — this DayWorksSheet's own DELETE route
  // deletes its storageKey from S3, which would otherwise silently wipe
  // out the original Update attachment/Picture out from under it.
  const contentTypeHeader = request.headers.get("content-type") ?? "";

  if (contentTypeHeader.includes("application/json")) {
    const payload = await request.json().catch(() => null);
    const source = payload?.source;
    if (
      !source ||
      (source.type !== "update-attachment" && source.type !== "variation-photo") ||
      typeof source.id !== "string"
    ) {
      return NextResponse.json({ error: "Invalid source reference" }, { status: 400 });
    }

    const sourceRecord =
      source.type === "update-attachment"
        ? await prisma.updateAttachment.findFirst({ where: { id: source.id, update: { projectId } } })
        : await prisma.variationPhoto.findFirst({ where: { id: source.id, variationItem: { projectId } } });

    if (!sourceRecord) {
      return NextResponse.json({ error: "Source image not found" }, { status: 404 });
    }

    const buffer = await downloadFromS3(sourceRecord.storageKey);
    const uploadKey = `projects/${projectId}/variation-items/${itemId}/day-works/${Date.now()}-${sourceRecord.fileName}`;
    const contentType = sourceRecord.contentType || "application/octet-stream";
    const { storageKey } = await uploadToS3({ key: uploadKey, body: buffer, contentType });

    const dayWorksSheet = await prisma.dayWorksSheet.create({
      data: { variationItemId: itemId, fileName: sourceRecord.fileName, storageKey, contentType }
    });

    return NextResponse.json({ dayWorksSheet }, { status: 201 });
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

  const buffer = new Uint8Array(await file.arrayBuffer());
  const uploadKey = `projects/${projectId}/variation-items/${itemId}/day-works/${Date.now()}-${file.name}`;
  const contentType = file.type || "application/octet-stream";
  const { storageKey } = await uploadToS3({ key: uploadKey, body: buffer, contentType });

  const dayWorksSheet = await prisma.dayWorksSheet.create({
    data: { variationItemId: itemId, fileName: file.name, storageKey, contentType }
  });

  return NextResponse.json({ dayWorksSheet }, { status: 201 });
}
