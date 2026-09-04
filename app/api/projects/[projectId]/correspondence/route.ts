import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { uploadToS3 } from "@/lib/s3";
import { ALLOWED_ATTACHMENT_TYPES, MAX_ATTACHMENT_SIZE_BYTES, isAllowedAttachmentType } from "@/lib/update-attachments";

export async function GET(request: Request, context: { params: { projectId: string } }) {
  const userId = await requireUserId(request);
  const { projectId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const canAccessModule = await requireModuleAccess(projectId, userId, "correspondence");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const correspondence = await prisma.correspondence.findMany({
    where: { projectId },
    include: { variationItem: { select: { id: true, reference: true, title: true } } },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ correspondence });
}

export async function POST(request: Request, context: { params: { projectId: string } }) {
  const userId = await requireUserId(request);
  const { projectId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const canAccessModule = await requireModuleAccess(projectId, userId, "correspondence");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const title = formData.get("title")?.toString();
  const variationItemId = formData.get("variationItemId")?.toString() || undefined;
  const file = formData.get("file");

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  if (variationItemId) {
    const item = await prisma.variationItem.findFirst({ where: { id: variationItemId, projectId } });
    if (!item) {
      return NextResponse.json({ error: "Variation/Site Instruction not found" }, { status: 400 });
    }
  }

  let fileName: string | undefined;
  let storageKey: string | undefined;

  if (file instanceof File && file.size > 0) {
    if (!isAllowedAttachmentType(file.type)) {
      return NextResponse.json({ error: `File must be one of: ${ALLOWED_ATTACHMENT_TYPES.join(", ")}.` }, { status: 400 });
    }
    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      return NextResponse.json({ error: "File must be 20MB or smaller." }, { status: 400 });
    }
    const buffer = new Uint8Array(await file.arrayBuffer());
    const uploadKey = `projects/${projectId}/correspondence/${Date.now()}-${file.name}`;
    const uploaded = await uploadToS3({ key: uploadKey, body: buffer, contentType: file.type || "application/octet-stream" });
    fileName = file.name;
    storageKey = uploaded.storageKey;
  }

  const correspondence = await prisma.correspondence.create({
    data: {
      projectId,
      variationItemId,
      title,
      fileName,
      storageKey,
      source: "upload"
    }
  });

  return NextResponse.json({ correspondence }, { status: 201 });
}
