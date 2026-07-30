import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { deleteFromS3, uploadToS3 } from "@/lib/s3";
import { processContractDocument } from "@/lib/document-processing";
import { startContractReview } from "@/lib/contract-comparison";

// Logs an outcome against a response-letter-draft Correspondence entry — a
// free-text note, and/or a revised contract re-upload. A re-uploaded
// contract goes through the normal upload + background-extraction +
// automatic review pipeline (fire-and-forget, matching how a direct Contract
// upload behaves) so it becomes this Main Contractor's new "most recent
// reviewed contract" for the comparison chain (see lib/contract-comparison.ts)
// as soon as processing completes — no extra manual "Run Review" click
// needed.
export async function PATCH(request: Request, context: { params: { projectId: string; id: string } }) {
  const userId = await requireUserId(request);
  const { projectId, id } = context.params;
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

  const existing = await prisma.correspondence.findFirst({ where: { id, projectId } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { organisationId: true } });
  const trigger = { organisationId: project?.organisationId ?? null, userId };
  if (existing.source !== "response_letter_draft") {
    return NextResponse.json({ error: "Outcomes can only be logged against a response letter draft." }, { status: 400 });
  }

  const formData = await request.formData();
  const outcomeNote = formData.get("outcomeNote")?.toString();
  const file = formData.get("file");

  let outcomeContractDocumentId: string | undefined;

  if (file instanceof File && file.size > 0) {
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF files can be uploaded as a revised contract." }, { status: 400 });
    }
    const buffer = new Uint8Array(await file.arrayBuffer());
    const uploadKey = `projects/${projectId}/contracts/${Date.now()}-${file.name}`;
    const { fileUrl, storageKey } = await uploadToS3({ key: uploadKey, body: buffer, contentType: file.type });

    const document = await prisma.contractDocument.create({
      data: { projectId, title: file.name, fileName: file.name, fileUrl, storageKey, status: "draft" }
    });
    outcomeContractDocumentId = document.id;

    void (async () => {
      await processContractDocument(projectId, document.id, trigger);
      const processed = await prisma.contractDocument.findUnique({ where: { id: document.id } });
      if (processed?.processingStatus === "ready") {
        await startContractReview(projectId, document.id, trigger);
      }
    })().catch((error) => {
      console.error("Unhandled error processing revised contract outcome:", error);
    });
  }

  if (!outcomeNote && !outcomeContractDocumentId) {
    return NextResponse.json({ error: "Add a note or upload a revised contract." }, { status: 400 });
  }

  const correspondence = await prisma.correspondence.update({
    where: { id },
    data: {
      outcomeNote: outcomeNote || undefined,
      outcomeContractDocumentId
    }
  });

  return NextResponse.json({ correspondence });
}

export async function DELETE(request: Request, context: { params: { projectId: string; id: string } }) {
  const userId = await requireUserId(request);
  const { projectId, id } = context.params;
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

  const correspondence = await prisma.correspondence.findFirst({ where: { id, projectId } });
  if (!correspondence) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (correspondence.source !== "upload") {
    return NextResponse.json({ error: "Received emails can't be deleted here." }, { status: 400 });
  }

  if (correspondence.storageKey) {
    await deleteFromS3(correspondence.storageKey).catch(() => {});
  }
  await prisma.correspondence.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
