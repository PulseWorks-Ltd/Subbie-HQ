import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { uploadToS3 } from "@/lib/s3";
import { generateThumbnail } from "@/lib/image-thumbnails";
import { ALLOWED_IMAGE_TYPES, MAX_ATTACHMENT_SIZE_BYTES, isAllowedImageType } from "@/lib/update-attachments";

const MAX_PHOTOS = 10;

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

  const photos = await prisma.variationPhoto.findMany({
    where: { variationItemId: itemId },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ photos });
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
  const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (files.length === 0) {
    return NextResponse.json({ error: "No photos provided" }, { status: 400 });
  }
  if (files.length > MAX_PHOTOS) {
    return NextResponse.json({ error: `You can upload up to ${MAX_PHOTOS} photos at once.` }, { status: 400 });
  }
  if (files.some((file) => !isAllowedImageType(file.type))) {
    return NextResponse.json({ error: `Only ${ALLOWED_IMAGE_TYPES.join(" or ")} images can be uploaded here.` }, { status: 400 });
  }
  if (files.some((file) => file.size > MAX_ATTACHMENT_SIZE_BYTES)) {
    return NextResponse.json({ error: "Each photo must be 20MB or smaller." }, { status: 400 });
  }

  const photos = [];
  for (const file of files) {
    const buffer = new Uint8Array(await file.arrayBuffer());
    const uploadKey = `projects/${projectId}/variation-items/${itemId}/photos/${Date.now()}-${file.name}`;
    const { storageKey } = await uploadToS3({ key: uploadKey, body: buffer, contentType: file.type });

    // Best-effort, same as the Update-attachment upload path — a
    // thumbnail failing to generate must never block the actual photo
    // upload; the file route falls back to the original when unset.
    let thumbnailStorageKey: string | null = null;
    try {
      const thumbnailBuffer = await generateThumbnail(buffer);
      const thumbnailKey = `projects/${projectId}/variation-items/${itemId}/photos/thumb-${Date.now()}-${file.name}.jpg`;
      const thumbnailUpload = await uploadToS3({ key: thumbnailKey, body: thumbnailBuffer, contentType: "image/jpeg" });
      thumbnailStorageKey = thumbnailUpload.storageKey;
    } catch {
      // fall through with thumbnailStorageKey left null
    }

    const photo = await prisma.variationPhoto.create({
      data: { variationItemId: itemId, fileName: file.name, storageKey, contentType: file.type, thumbnailStorageKey }
    });
    photos.push(photo);
  }

  return NextResponse.json({ photos }, { status: 201 });
}
