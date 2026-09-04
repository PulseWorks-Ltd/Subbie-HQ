import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { uploadToS3 } from "@/lib/s3";
import { SAFETY_DOCUMENT_TYPES } from "@/lib/safety-document-types";
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

  const canAccessModule = await requireModuleAccess(projectId, userId, "health_safety");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const safetyDocuments = await prisma.safetyDocument.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ safetyDocuments });
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

  const canAccessModule = await requireModuleAccess(projectId, userId, "health_safety");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const title = formData.get("title")?.toString();
  const notes = formData.get("notes")?.toString();
  const expiresAt = formData.get("expiresAt")?.toString();
  const typeRaw = formData.get("type")?.toString();
  const file = formData.get("file");

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (typeRaw && !(SAFETY_DOCUMENT_TYPES as string[]).includes(typeRaw)) {
    return NextResponse.json({ error: "Invalid document type" }, { status: 400 });
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
    const uploadKey = `projects/${projectId}/safety-documents/${Date.now()}-${file.name}`;
    const uploaded = await uploadToS3({ key: uploadKey, body: buffer, contentType: file.type || "application/octet-stream" });
    fileName = file.name;
    storageKey = uploaded.storageKey;
  }

  const safetyDocument = await prisma.safetyDocument.create({
    data: {
      projectId,
      title,
      type: typeRaw ? (typeRaw as (typeof SAFETY_DOCUMENT_TYPES)[number]) : undefined,
      notes: notes || undefined,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      fileName,
      storageKey
    }
  });

  return NextResponse.json({ safetyDocument }, { status: 201 });
}
