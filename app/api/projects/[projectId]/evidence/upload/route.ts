import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { uploadToS3 } from "@/lib/s3";
import { ALLOWED_ATTACHMENT_TYPES, MAX_ATTACHMENT_SIZE_BYTES, isAllowedAttachmentType } from "@/lib/update-attachments";

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

  const canAccessModule = await requireModuleAccess(projectId, userId, "evidence");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const title = formData.get("title")?.toString();

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
  const uploadKey = `projects/${projectId}/evidence/${Date.now()}-${file.name}`;

  const { fileUrl, storageKey } = await uploadToS3({
    key: uploadKey,
    body: buffer,
    contentType: file.type || "application/octet-stream"
  });

  const evidence = await prisma.evidence.create({
    data: {
      projectId,
      type: "upload",
      status: "draft",
      title: title || file.name,
      fileName: file.name,
      fileUrl,
      storageKey
    }
  });

  return NextResponse.json({ evidence }, { status: 201 });
}
