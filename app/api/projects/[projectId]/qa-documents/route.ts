import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { uploadToS3 } from "@/lib/s3";
import { generateQaDocumentPdf } from "@/lib/qa-document-pdf";

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
  const canAccessModule = await requireModuleAccess(projectId, userId, "quality_assurance");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const qaDocuments = await prisma.qaDocument.findMany({
    where: { projectId },
    include: {
      generatedByUser: { select: { firstName: true, lastName: true, email: true } },
      records: {
        orderBy: { sortOrder: "asc" },
        include: { qaRecord: { select: { id: true, stage: true, notes: true, date: true } } }
      }
    },
    orderBy: { docNumber: "desc" }
  });

  return NextResponse.json({ qaDocuments });
}

const createSchema = z.object({
  qaRecordIds: z.array(z.string()).min(1, "Select at least one QA record."),
  siteAddress: z.string().optional(),
  contractReference: z.string().optional()
});

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
  const canAccessModule = await requireModuleAccess(projectId, userId, "quality_assurance");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = createSchema.parse(await request.json());

  // Every id must belong to this project AND not already be included in a
  // previous document — re-checked here rather than trusting the client's
  // "not yet included" list it fetched a moment earlier (it could be
  // stale if another tab/user generated a document in the meantime).
  const records = await prisma.qARecord.findMany({
    where: { id: { in: payload.qaRecordIds }, projectId },
    select: { id: true, documentLinks: { select: { id: true } } }
  });
  if (records.length !== payload.qaRecordIds.length) {
    return NextResponse.json({ error: "One or more QA records were not found on this project." }, { status: 400 });
  }
  const alreadyIncluded = records.filter((record) => record.documentLinks.length > 0);
  if (alreadyIncluded.length > 0) {
    return NextResponse.json(
      { error: "One or more selected QA records are already included in a previous document — refresh and try again." },
      { status: 409 }
    );
  }

  const latest = await prisma.qaDocument.findFirst({ where: { projectId }, orderBy: { docNumber: "desc" } });
  const docNumber = (latest?.docNumber ?? 0) + 1;

  const pdfBytes = await generateQaDocumentPdf({
    projectId,
    qaRecordIds: payload.qaRecordIds,
    siteAddress: payload.siteAddress?.trim() || null,
    contractReference: payload.contractReference?.trim() || null,
    docNumber,
    generatedByUserId: userId
  });

  const fileName = `QA Document ${docNumber}.pdf`;
  const uploadKey = `projects/${projectId}/qa-records/qa-documents/${Date.now()}-qa-document-${docNumber}.pdf`;
  const { storageKey } = await uploadToS3({ key: uploadKey, body: pdfBytes, contentType: "application/pdf" });

  const qaDocument = await prisma.qaDocument.create({
    data: {
      projectId,
      docNumber,
      fileName,
      storageKey,
      siteAddress: payload.siteAddress?.trim() || null,
      contractReference: payload.contractReference?.trim() || null,
      generatedByUserId: userId,
      records: {
        create: payload.qaRecordIds.map((qaRecordId, index) => ({ qaRecordId, sortOrder: index }))
      }
    },
    include: {
      records: { orderBy: { sortOrder: "asc" }, include: { qaRecord: { select: { id: true, stage: true, notes: true, date: true } } } }
    }
  });

  return NextResponse.json({ qaDocument }, { status: 201 });
}
