import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { uploadToS3 } from "@/lib/s3";
import { renderPdfPagesToImages, UnreadablePdfError } from "@/lib/pdf-text-extraction";
import { extractPaymentScheduleFromImages } from "@/lib/grok";
import { AiSpendCapExceededError } from "@/lib/ai-usage";
import { ALLOWED_ATTACHMENT_TYPES, MAX_ATTACHMENT_SIZE_BYTES, isAllowedAttachmentType } from "@/lib/update-attachments";
import { createDraftReconciliationFromExtraction } from "@/lib/payment-reconciliation";
import { linkClaimEvidence } from "@/lib/payment-claim";

function parseNullableDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Upload a contractor Payment Schedule document, extract it, and persist
// the result immediately as a draft ContractorPaymentSchedule (Section 17
// of the spec this implements — deliberately unlike the Day Works flow,
// which never persists a draft at all: this is durable commercial
// information that must survive the user navigating away before
// reviewing/confirming it).
export async function POST(request: Request, context: { params: { projectId: string; claimId: string } }) {
  const userId = await requireUserId(request);
  const { projectId, claimId } = context.params;
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

  const claim = await prisma.paymentClaim.findFirst({ where: { id: claimId, projectId }, select: { id: true, status: true } });
  if (!claim) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (claim.status === "draft") {
    return NextResponse.json({ error: "This claim hasn't been sent yet — there's nothing to record a response against." }, { status: 409 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
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
  const contentType = file.type || "application/octet-stream";

  let images: { dataUrl: string }[];
  if (contentType === "application/pdf") {
    try {
      const pages = await renderPdfPagesToImages(buffer);
      images = pages.map((page) => ({ dataUrl: page.dataUrl }));
    } catch (error) {
      if (error instanceof UnreadablePdfError) {
        return NextResponse.json(
          { error: "This file's pages couldn't be read automatically. Please add the response manually instead." },
          { status: 422 }
        );
      }
      throw error;
    }
  } else if (contentType.startsWith("image/")) {
    const base64 = Buffer.from(buffer).toString("base64");
    images = [{ dataUrl: `data:${contentType};base64,${base64}` }];
  } else {
    return NextResponse.json(
      { error: "This file type can't be read automatically. Please add the response manually instead." },
      { status: 422 }
    );
  }

  const uploadKey = `projects/${projectId}/payment-claims/${claimId}/reconciliation/${Date.now()}-${file.name}`;
  const { storageKey } = await uploadToS3({ key: uploadKey, body: buffer, contentType });

  let extracted;
  try {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { organisationId: true } });
    extracted = await extractPaymentScheduleFromImages(images, {
      organisationId: project?.organisationId ?? null,
      userId,
      contextRef: claimId
    });
  } catch (error) {
    if (error instanceof AiSpendCapExceededError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    return NextResponse.json(
      { error: "Could not read this document automatically. You can still add the response manually." },
      { status: 422 }
    );
  }

  const schedule = await createDraftReconciliationFromExtraction({
    paymentClaimId: claimId,
    userId,
    extracted: {
      claimedAmount: extracted.claimedAmount,
      certifiedAmount: extracted.certifiedAmount,
      declineLines: extracted.declineLines,
      statedRetentionAmount: extracted.statedRetentionAmount,
      adjustments: extracted.adjustments,
      receivedAmount: extracted.receivedAmount,
      paymentDueDate: parseNullableDate(extracted.paymentDueDate),
      paymentReceivedDate: parseNullableDate(extracted.paymentReceivedDate),
      confidence: extracted.confidence,
      notes: extracted.notes
    },
    fileName: file.name,
    storageKey,
    contentType
  });

  // Linked as claim evidence immediately (not gated on later confirmation)
  // — the document itself is real evidence the moment it's uploaded,
  // same as a VariationPackage is linked as soon as it's generated.
  await linkClaimEvidence({ paymentClaimId: claimId, evidenceType: "contractor_payment_schedule", evidenceId: schedule.id });

  return NextResponse.json({ schedule }, { status: 201 });
}
