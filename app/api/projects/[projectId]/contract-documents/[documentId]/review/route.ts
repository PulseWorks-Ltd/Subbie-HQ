import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { processContractDocument } from "@/lib/document-processing";
import { startContractReview, getContractReviewWithDetails, getNewBaselineDriftDeviations } from "@/lib/contract-comparison";

export async function GET(
  request: Request,
  context: { params: { projectId: string; documentId: string } }
) {
  const userId = await requireUserId(request);
  const { projectId, documentId } = context.params;
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

  const review = await prisma.contractReview.findFirst({
    where: { documentId, projectId, isPrimary: true },
    orderBy: { createdAt: "desc" },
    include: {
      deviations: { orderBy: { priorityScore: "desc" } },
      comparedAgainstReview: { include: { document: { select: { title: true, fileName: true, uploadedAt: true } } } }
    }
  });
  const driftDeviations = review
    ? await getNewBaselineDriftDeviations(review.documentId, review.comparedAgainstType, review.newBaselineDriftCount)
    : [];

  return NextResponse.json({ review: review ? { ...review, driftDeviations } : null });
}

export async function POST(
  request: Request,
  context: { params: { projectId: string; documentId: string } }
) {
  const userId = await requireUserId(request);
  const { projectId, documentId } = context.params;
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

  const document = await prisma.contractDocument.findFirst({ where: { id: documentId, projectId } });
  if (!document) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Clause extraction (OCR-if-needed + Grok) now happens in the background,
  // kicked off at upload time — see lib/document-processing.ts. This route
  // just reads whatever's already there. Reusing existing Clause rows (incl.
  // manually-entered ones) rather than requiring processingStatus === "ready"
  // keeps this working for documents uploaded before this change existed.
  let clauses = await prisma.clause.findMany({ where: { documentId, projectId } });

  if (clauses.length === 0) {
    if (document.processingStatus === "processing") {
      return NextResponse.json(
        { error: "This document is still being processed automatically — please wait a moment and try again." },
        { status: 409 }
      );
    }
    if (document.processingStatus === "failed") {
      return NextResponse.json(
        { error: document.processingError ?? "Could not process this document automatically. You can still add clauses manually." },
        { status: 422 }
      );
    }
    // processingStatus is "idle" (background extraction never ran — e.g. a
    // non-PDF upload, or a document created before this change existed) or
    // "ready" with somehow zero clauses — either way, fall back to running
    // extraction synchronously here, matching the old click-and-wait behavior.
    await processContractDocument(projectId, documentId);
    clauses = await prisma.clause.findMany({ where: { documentId, projectId } });
    if (clauses.length === 0) {
      const failedDocument = await prisma.contractDocument.findUniqueOrThrow({ where: { id: documentId } });
      const message = failedDocument.processingError ?? "Could not process this document automatically. You can still add clauses manually.";
      return NextResponse.json({ error: message }, { status: 422 });
    }
  }

  // Starts the review in the background and returns almost immediately with
  // a "running" review the frontend polls via GET — the actual Grok work
  // can take several minutes for a real contract, far too long to hold this
  // request open for (and if the user navigated away mid-request under the
  // old synchronous design, all progress was lost and had to be rerun from
  // scratch at full Grok cost). If a review is already running for this
  // document, startContractReview returns that one rather than starting a
  // duplicate.
  const { reviewId } = await startContractReview(projectId, documentId);
  const review = await getContractReviewWithDetails(reviewId);
  return NextResponse.json({ review }, { status: 202 });
}

