import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { uploadToS3 } from "@/lib/s3";
import { renderPdfPagesToImages, UnreadablePdfError } from "@/lib/pdf-text-extraction";
import { extractContractScheduleFromImages } from "@/lib/grok";
import { AiSpendCapExceededError } from "@/lib/ai-usage";

// Phase 2 of the Contract Schedule feature — reads an uploaded quote via
// Grok vision (never plain text extraction; see lib/grok.ts's
// extractContractScheduleFromImages for why) and returns a DRAFT
// extraction for the user to review/edit before anything is saved as real
// ContractItem rows (see the separate confirm-extraction route, mirroring
// the day-works-sheet-records/extract → save split already established in
// this codebase). The uploaded file itself IS saved to S3 here regardless
// of whether the user goes on to confirm — same behaviour as every other
// upload+extract flow in this app (the source document is never lost even
// if extraction is poor or abandoned).
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
  const canAccessModule = await requireModuleAccess(projectId, userId, "payment_claims");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const contentType = file.type || "application/octet-stream";
  const uploadKey = `projects/${projectId}/contract-schedule/${Date.now()}-${file.name}`;
  const { storageKey } = await uploadToS3({ key: uploadKey, body: buffer, contentType });

  try {
    let images: { dataUrl: string }[];
    if (contentType === "application/pdf") {
      const pages = await renderPdfPagesToImages(buffer);
      images = pages.map((page) => ({ dataUrl: page.dataUrl }));
    } else if (contentType.startsWith("image/")) {
      const base64 = Buffer.from(buffer).toString("base64");
      images = [{ dataUrl: `data:${contentType};base64,${base64}` }];
    } else {
      return NextResponse.json(
        {
          error: "This file type can't be read automatically. The file has been saved — please add items manually.",
          sourceFileName: file.name,
          sourceStorageKey: storageKey,
          sourceContentType: contentType
        },
        { status: 422 }
      );
    }

    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { organisationId: true } });
    const extraction = await extractContractScheduleFromImages(images, {
      organisationId: project?.organisationId ?? null,
      userId,
      contextRef: projectId
    });

    return NextResponse.json({
      extraction,
      sourceFileName: file.name,
      sourceStorageKey: storageKey,
      sourceContentType: contentType
    });
  } catch (error) {
    if (error instanceof AiSpendCapExceededError) {
      return NextResponse.json({ error: error.message, sourceFileName: file.name, sourceStorageKey: storageKey, sourceContentType: contentType }, { status: 422 });
    }
    const message =
      error instanceof UnreadablePdfError
        ? "This file's pages couldn't be read automatically. The file has been saved — please add items manually."
        : "Could not read this quote automatically. The file has been saved — please add items manually.";
    return NextResponse.json({ error: message, sourceFileName: file.name, sourceStorageKey: storageKey, sourceContentType: contentType }, { status: 422 });
  }
}
