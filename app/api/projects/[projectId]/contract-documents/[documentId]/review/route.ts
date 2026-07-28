import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { getSignedDownloadUrl } from "@/lib/s3";
import {
  extractContractClausesFromText,
  compareClausesToStandardBucket,
  synthesizeContractReview,
  extractContractTermsFromClauses
} from "@/lib/grok";
import { getStandardForm, getStandardFormBuckets, getStandardFormClausesByBucket } from "@/lib/standard-forms/sa-2017";

const PAGE_BATCH_SIZE = 8;

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
    where: { documentId, projectId },
    orderBy: { createdAt: "desc" },
    include: { deviations: { orderBy: { priorityScore: "desc" } } }
  });

  return NextResponse.json({ review });
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

  const standardForm = getStandardForm();

  const review = await prisma.contractReview.create({
    data: { projectId, documentId, standardFormVersion: standardForm.version, status: "running" }
  });

  try {
    // Step 0 — reuse existing Clause rows for this document if any exist
    // (including manually-entered ones — never silently duplicate/overwrite
    // them), otherwise extract fresh via a page-chunked pass.
    let clauses = await prisma.clause.findMany({ where: { documentId, projectId } });

    if (clauses.length === 0) {
      const signedUrl = await getSignedDownloadUrl(document.storageKey);
      const pdfResponse = await fetch(signedUrl);
      const buffer = new Uint8Array(await pdfResponse.arrayBuffer());
      const parser = new PDFParse({ data: buffer });
      const { pages } = await parser.getText();
      await parser.destroy();

      if (!pages.length) {
        throw new Error("No extractable text in PDF.");
      }

      const batches: typeof pages[] = [];
      for (let i = 0; i < pages.length; i += PAGE_BATCH_SIZE) {
        batches.push(pages.slice(i, i + PAGE_BATCH_SIZE));
      }

      const extractedBatches = await Promise.all(
        batches.map((batch) => {
          const batchText = batch.map((p) => `--- PAGE ${p.num} ---\n${p.text}`).join("\n\n");
          return extractContractClausesFromText(batchText);
        })
      );
      const extractedClauses = extractedBatches.flat();

      await prisma.clause.createMany({
        data: extractedClauses.map((c) => ({
          projectId,
          documentId,
          clauseRef: c.clauseRef,
          title: c.title,
          body: c.body,
          pageNumber: c.pageNumber,
          status: "parsed"
        }))
      });

      clauses = await prisma.clause.findMany({ where: { documentId, projectId } });
    }

    const clauseInputs = clauses.map((c) => ({ clauseRef: c.clauseRef, title: c.title, body: c.body }));

    // Step 1 (map, parallel) + terms extraction run concurrently — both only
    // depend on the already-extracted clauses, not on each other.
    const buckets = getStandardFormBuckets();
    const [bucketResults, extractedTerms] = await Promise.all([
      Promise.all(
        buckets.map(async (bucket) => {
          const baselineClauses = getStandardFormClausesByBucket(bucket).map((c) => ({
            clauseRef: c.clauseRef,
            title: c.title,
            body: c.body
          }));
          const deviations = await compareClausesToStandardBucket(bucket, baselineClauses, clauseInputs);
          return { topicBucket: bucket, deviations };
        })
      ),
      extractContractTermsFromClauses(
        clauses.map((c) => ({ clauseRef: c.clauseRef, title: c.title, body: c.body, pageNumber: c.pageNumber }))
      )
    ]);

    // Step 2 (reduce) — prioritize and summarize.
    const synthesis = await synthesizeContractReview(bucketResults);

    const majorDeviationCount = synthesis.deviations.filter(
      (d) =>
        d.classification === "major_deviation" ||
        d.classification === "missing_from_subcontract" ||
        d.classification === "additional_in_subcontract"
    ).length;
    const minorDeviationCount = synthesis.deviations.filter((d) => d.classification === "minor_deviation").length;

    await prisma.contractDeviation.createMany({
      data: synthesis.deviations.map((d) => ({
        contractReviewId: review.id,
        topicBucket: d.topicBucket,
        baselineClauseRef: d.baselineClauseRef,
        baselineClauseTitle: d.baselineClauseTitle,
        subcontractClauseRef: d.subcontractClauseRef,
        subcontractExcerpt: d.subcontractExcerpt,
        classification: d.classification,
        impact: d.impact,
        priorityScore: d.priorityScore,
        rationale: d.rationale,
        recommendation: d.recommendation
      }))
    });

    await prisma.contractReview.update({
      where: { id: review.id },
      data: {
        status: "complete",
        executiveSummary: synthesis.executiveSummary,
        overallRiskLevel: synthesis.overallRiskLevel,
        majorDeviationCount,
        minorDeviationCount,
        completedAt: new Date(),
        rawModelOutputs: { bucketResults, synthesis } as unknown as object
      }
    });

    // Only suggest a field the human hasn't already confirmed a value for —
    // re-running a review shouldn't resurface an amber "suggested" badge next
    // to a value that's already correctly set.
    const existingTerms = await prisma.contractTerms.findUnique({ where: { projectId } });
    function suggestIfUnconfirmed<T>(realValue: T | null | undefined, extracted: T | null): T | null | undefined {
      return realValue === null || realValue === undefined ? extracted : undefined;
    }

    await prisma.contractTerms.upsert({
      where: { projectId },
      create: {
        projectId,
        sourceDocumentId: documentId,
        sourceContractReviewId: review.id,
        suggestedPaymentClaimMethod: extractedTerms.paymentClaimMethod,
        suggestedPaymentClaimDay: extractedTerms.paymentClaimDay,
        suggestedVariationNoticePeriodDays: extractedTerms.variationNoticePeriodDays,
        suggestedVariationNoticeMethod: extractedTerms.variationNoticeMethod,
        suggestedRetentionPercent: extractedTerms.retentionPercent,
        suggestedDefectsLiabilityPeriodDays: extractedTerms.defectsLiabilityPeriodDays,
        suggestedDisputeNoticeMethod: extractedTerms.disputeNoticeMethod,
        suggestedGeneralNoticeMethod: extractedTerms.generalNoticeMethod
      },
      update: {
        sourceDocumentId: documentId,
        sourceContractReviewId: review.id,
        suggestedPaymentClaimMethod: suggestIfUnconfirmed(existingTerms?.paymentClaimMethod, extractedTerms.paymentClaimMethod),
        suggestedPaymentClaimDay: suggestIfUnconfirmed(existingTerms?.paymentClaimDay, extractedTerms.paymentClaimDay),
        suggestedVariationNoticePeriodDays: suggestIfUnconfirmed(
          existingTerms?.variationNoticePeriodDays,
          extractedTerms.variationNoticePeriodDays
        ),
        suggestedVariationNoticeMethod: suggestIfUnconfirmed(
          existingTerms?.variationNoticeMethod,
          extractedTerms.variationNoticeMethod
        ),
        suggestedRetentionPercent: suggestIfUnconfirmed(existingTerms?.retentionPercent, extractedTerms.retentionPercent),
        suggestedDefectsLiabilityPeriodDays: suggestIfUnconfirmed(
          existingTerms?.defectsLiabilityPeriodDays,
          extractedTerms.defectsLiabilityPeriodDays
        ),
        suggestedDisputeNoticeMethod: suggestIfUnconfirmed(
          existingTerms?.disputeNoticeMethod,
          extractedTerms.disputeNoticeMethod
        ),
        suggestedGeneralNoticeMethod: suggestIfUnconfirmed(
          existingTerms?.generalNoticeMethod,
          extractedTerms.generalNoticeMethod
        )
      }
    });

    const fullReview = await prisma.contractReview.findUnique({
      where: { id: review.id },
      include: { deviations: { orderBy: { priorityScore: "desc" } } }
    });

    return NextResponse.json({ review: fullReview });
  } catch (error) {
    console.error("Contract review failed:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const failedReview = await prisma.contractReview.update({
      where: { id: review.id },
      data: { status: "failed", errorMessage }
    });
    return NextResponse.json(
      {
        error: "Could not complete an automated review of this document. You can still review it manually.",
        review: failedReview
      },
      { status: 422 }
    );
  }
}

