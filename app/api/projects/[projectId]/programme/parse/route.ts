import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, requireUserId } from "@/lib/auth";
import { uploadToS3 } from "@/lib/s3";
import { extractProgrammeFromText } from "@/lib/grok";

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

  // The document being replaced (if any) — only its still-unreviewed items get
  // superseded below. Anything already confirmed by a human is left alone.
  const previousDocument = await prisma.contractDocument.findFirst({
    where: { projectId, documentType: "programme" },
    orderBy: { uploadedAt: "desc" }
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

  let extracted;
  try {
    const parser = new PDFParse({ data: buffer });
    const { text } = await parser.getText();
    await parser.destroy();

    if (!text.trim()) {
      throw new Error("No extractable text in PDF.");
    }

    extracted = await extractProgrammeFromText(text, tradeReference);
  } catch {
    return NextResponse.json(
      {
        error: "Could not read this document automatically. You can still add milestones manually.",
        document
      },
      { status: 422 }
    );
  }

  let replacedCount = 0;
  if (previousDocument) {
    const superseded = await prisma.programmeItem.findMany({
      where: { sourceDocumentId: previousDocument.id, status: "parsed" },
      select: { id: true }
    });
    const supersededIds = superseded.map((item) => item.id);

    if (supersededIds.length) {
      await prisma.scopeProgrammeLink.deleteMany({ where: { programmeItemId: { in: supersededIds } } });
      await prisma.evidenceProgrammeItem.deleteMany({ where: { programmeItemId: { in: supersededIds } } });
      await prisma.programmeItem.deleteMany({ where: { id: { in: supersededIds } } });
      replacedCount = supersededIds.length;
    }
  }

  const items = await prisma.$transaction(
    extracted.items.map((item) =>
      prisma.programmeItem.create({
        data: {
          projectId,
          title: item.title,
          description: item.description ?? undefined,
          startDate: item.startDate ? new Date(item.startDate) : undefined,
          endDate: item.endDate ? new Date(item.endDate) : undefined,
          status: "parsed",
          confidence: item.confidence,
          sourceDocumentId: document.id
        }
      })
    )
  );

  return NextResponse.json(
    { items, document, replacedCount, filterApplied: extracted.filterApplied, tradeReference },
    { status: 201 }
  );
}
