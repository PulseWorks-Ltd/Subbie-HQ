import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { uploadToS3 } from "@/lib/s3";
import { renderPdfPagesToImages, UnreadablePdfError } from "@/lib/pdf-text-extraction";
import { extractPaymentClaimBaselineFromImages } from "@/lib/grok";
import { AiSpendCapExceededError } from "@/lib/ai-usage";
import { MAX_ATTACHMENT_SIZE_BYTES } from "@/lib/update-attachments";
import { computeDocumentHash, findConfirmedDuplicateImport, createDraftPaymentClaimImport, getPaymentClaimImportsForProject } from "@/lib/payment-claim-import";

function parseNullableDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

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
  const canAccessModule = await requireModuleAccess(projectId, userId, "payment_claims");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const imports = await getPaymentClaimImportsForProject(projectId);
  return NextResponse.json({ imports });
}

// "Import Existing Payment Claim" — upload, hash-check for a duplicate
// BEFORE spending an AI call (Section 33), extract, and persist the
// result immediately as a draft (never held only in React state — this is
// durable commercial information the user may step away from mid-review,
// same reasoning as lib/payment-reconciliation.ts's draft extraction).
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
  if (!file || !(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  // PDF only for V1 (Section 35's own instruction: don't force XLSX
  // support — no existing extraction path for it in this codebase).
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Please upload the payment claim as a PDF." }, { status: 400 });
  }
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return NextResponse.json({ error: "File must be 20MB or smaller." }, { status: 400 });
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const documentHash = computeDocumentHash(buffer);

  const duplicate = await findConfirmedDuplicateImport(projectId, documentHash);
  if (duplicate) {
    return NextResponse.json(
      {
        error: "This payment claim appears to have already been imported.",
        existingImportId: duplicate.id
      },
      { status: 409 }
    );
  }

  let images: { dataUrl: string }[];
  try {
    const pages = await renderPdfPagesToImages(buffer);
    images = pages.map((page) => ({ dataUrl: page.dataUrl }));
  } catch (error) {
    if (error instanceof UnreadablePdfError) {
      return NextResponse.json(
        { error: "This document's pages couldn't be read automatically. Extraction could not establish a reliable baseline." },
        { status: 422 }
      );
    }
    throw error;
  }

  const uploadKey = `projects/${projectId}/payment-claim-imports/${Date.now()}-${file.name}`;
  const { storageKey } = await uploadToS3({ key: uploadKey, body: buffer, contentType: file.type });

  let extracted;
  try {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { organisationId: true } });
    const raw = await extractPaymentClaimBaselineFromImages(images, { organisationId: project?.organisationId ?? null, userId, contextRef: projectId });
    extracted = {
      claimReference: raw.claimReference,
      claimDate: parseNullableDate(raw.claimDate),
      periodStart: parseNullableDate(raw.periodStart),
      periodEnd: parseNullableDate(raw.periodEnd),
      projectNameOnDocument: raw.projectNameOnDocument,
      projectReferenceOnDocument: raw.projectReferenceOnDocument,
      contractReferenceOnDocument: raw.contractReferenceOnDocument,
      originalContractSum: raw.originalContractSum,
      approvedVariationsTotal: raw.approvedVariationsTotal,
      revisedContractSum: raw.revisedContractSum,
      pendingVariationsTotal: raw.pendingVariationsTotal,
      grossClaimToDate: raw.grossClaimToDate,
      retentionPercent: raw.retentionPercent,
      retentionToDate: raw.retentionToDate,
      netClaimToDate: raw.netClaimToDate,
      previousClaims: raw.previousClaims,
      currentClaim: raw.currentClaim,
      contractItems: raw.contractItems,
      variations: raw.variations,
      confidence: raw.confidence,
      notes: raw.notes,
      arithmeticWarning: raw.arithmeticWarning
    };
  } catch (error) {
    if (error instanceof AiSpendCapExceededError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    return NextResponse.json(
      { error: "Extraction could not establish a reliable baseline from this document. You can cancel without changing the project." },
      { status: 422 }
    );
  }

  const draft = await createDraftPaymentClaimImport({
    projectId,
    userId,
    fileName: file.name,
    storageKey,
    contentType: file.type,
    documentHash,
    extracted
  });

  return NextResponse.json({ import: draft }, { status: 201 });
}
