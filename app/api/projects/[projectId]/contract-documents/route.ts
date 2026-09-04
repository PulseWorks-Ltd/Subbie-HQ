import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { uploadToS3 } from "@/lib/s3";
import { processContractDocument } from "@/lib/document-processing";
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

  const canAccessModule = await requireModuleAccess(projectId, userId, "contract");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const documents = await prisma.contractDocument.findMany({
    where: { projectId },
    orderBy: { uploadedAt: "desc" }
  });

  return NextResponse.json({ documents });
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

  const canAccessModule = await requireModuleAccess(projectId, userId, "contract");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const title = formData.get("title")?.toString() ?? "Contract Document";

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
  const uploadKey = `projects/${projectId}/contracts/${Date.now()}-${file.name}`;

  const { fileUrl, storageKey } = await uploadToS3({
    key: uploadKey,
    body: buffer,
    contentType: file.type || "application/pdf"
  });

  const [document, project] = await Promise.all([
    prisma.contractDocument.create({
      data: {
        projectId,
        title,
        fileName: file.name,
        fileUrl,
        storageKey,
        status: "draft"
      }
    }),
    prisma.project.findUnique({ where: { id: projectId }, select: { organisationId: true } })
  ]);

  // Fire-and-forget — clause extraction (OCR-if-needed + Grok) runs in the
  // background so the upload response stays fast. The "Run Contract Review"
  // action waits on processingStatus rather than extracting inline. Only
  // worth kicking off for real PDFs; other file types stay "idle" and get
  // handled by the review route's own synchronous fallback if ever needed.
  if (file.type === "application/pdf") {
    void processContractDocument(projectId, document.id, { organisationId: project?.organisationId ?? null, userId }).catch(
      (error) => {
        console.error("Unhandled error in processContractDocument:", error);
      }
    );
  }

  return NextResponse.json({ document }, { status: 201 });
}
