import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { uploadToS3 } from "@/lib/s3";
import { processProgrammeDocument } from "@/lib/document-processing";

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

  const canAccessModule = await requireModuleAccess(projectId, userId, "programme");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const tradeReferenceRaw = formData.get("tradeReference");
  const tradeReference = typeof tradeReferenceRaw === "string" && tradeReferenceRaw.trim() ? tradeReferenceRaw.trim() : undefined;

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF files can be parsed automatically." }, { status: 400 });
  }

  if (tradeReference) {
    await prisma.project.update({ where: { id: projectId }, data: { tradeReference } });
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const uploadKey = `projects/${projectId}/programme/${Date.now()}-${file.name}`;

  const { fileUrl, storageKey } = await uploadToS3({
    key: uploadKey,
    body: buffer,
    contentType: file.type
  });

  const document = await prisma.contractDocument.create({
    data: {
      projectId,
      title: file.name,
      fileName: file.name,
      fileUrl,
      storageKey,
      documentType: "programme"
    }
  });

  // Fire-and-forget — OCR-if-needed + milestone extraction (and the
  // supersede-previous-unconfirmed-items logic) run in the background so
  // this upload response stays fast even for large programme PDFs. The
  // frontend polls processingStatus on this document until it's "ready".
  void processProgrammeDocument(projectId, document.id, tradeReference).catch((error) => {
    console.error("Unhandled error in processProgrammeDocument:", error);
  });

  return NextResponse.json({ document, tradeReference }, { status: 201 });
}
