import { prisma } from "./prisma";
import {
  compareClausesToStandardBucket,
  compareClausesToPriorContract,
  synthesizeContractReview,
  extractContractTermsFromClauses,
  extractRequiredInsuranceCoverFromClauses,
  type BucketDeviation,
  type SynthesisResult
} from "./grok";
import { getStandardForm, getStandardFormBuckets, getStandardFormClausesByBucket } from "./standard-forms/sa-2017";
import type { Clause } from "@prisma/client";

const PRIOR_CONTRACT_LABEL = "their previous contract with this Main Contractor";

type ClauseInput = { clauseRef: string; title: string | null; body: string };

function toClauseInputs(clauses: Clause[]): ClauseInput[] {
  return clauses.map((c) => ({ clauseRef: c.clauseRef, title: c.title, body: c.body }));
}

// Firing all of SA-2017's ~13 topic-bucket calls at once via a single
// Promise.all was observed (verifying this feature) to make most of them
// queue for many minutes rather than genuinely run in parallel — a single
// isolated Grok call completes in ~5s, but 13 fired simultaneously can take
// 10+ minutes, most likely connection-pool/rate-limit contention rather than
// the API itself being slow. Capping concurrency (mirrors OCR_CONCURRENCY in
// lib/pdf-text-extraction.ts) keeps a steady handful in flight instead.
const GROK_CONCURRENCY = 4;

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

// Always run — every reviewed contract gets a full SA-2017 comparison,
// whether or not it's the one shown to the user as "the report" for this
// document (see runContractReview below). This is what makes newly-drifted
// clauses detectable later: both this contract's and its Main Contractor's
// PREVIOUS contract's baseline deviations are keyed by the same fixed
// SA-2017 baselineClauseRef, so they can be diffed directly.
async function runBaselineComparison(
  clauseInputs: ClauseInput[]
): Promise<{ bucketResults: { topicBucket: string; deviations: BucketDeviation[] }[]; synthesis: SynthesisResult }> {
  const buckets = getStandardFormBuckets();
  const bucketResults = await mapWithConcurrency(buckets, GROK_CONCURRENCY, async (bucket) => {
      const baselineClauses = getStandardFormClausesByBucket(bucket).map((c) => ({
        clauseRef: c.clauseRef,
        title: c.title,
        body: c.body
      }));
      const deviations = await compareClausesToStandardBucket(bucket, baselineClauses, clauseInputs);
      return { topicBucket: bucket, deviations };
    }
  );
  const synthesis = await synthesizeContractReview(bucketResults);
  return { bucketResults, synthesis };
}

function countDeviations(synthesis: SynthesisResult) {
  const majorDeviationCount = synthesis.deviations.filter(
    (d) =>
      d.classification === "major_deviation" ||
      d.classification === "missing_from_subcontract" ||
      d.classification === "additional_in_subcontract"
  ).length;
  const minorDeviationCount = synthesis.deviations.filter((d) => d.classification === "minor_deviation").length;
  return { majorDeviationCount, minorDeviationCount };
}

// Finds the Main Contractor's most recent PRIMARY completed review, across
// all of its projects, excluding the current document — this is "the
// previous contract" the new one gets compared against, and never comes
// from guessing/text matching (see Task 2.2's constraint).
async function findPriorReview(mainContractorId: string, excludeDocumentId: string) {
  return prisma.contractReview.findFirst({
    where: {
      isPrimary: true,
      status: "complete",
      document: { documentType: "contract", project: { mainContractorId } },
      documentId: { not: excludeDocumentId }
    },
    orderBy: { completedAt: "desc" },
    include: { document: true }
  });
}

// The baseline-tracking review for a given document — either the document's
// own primary review (if it WAS a baseline review, i.e. this MC's first-ever
// contract) or its sibling shadow review (isPrimary: false) created
// alongside a prior_contract primary review. Either way, comparedAgainstType
// is "baseline" and its deviations are keyed by SA-2017 baselineClauseRef.
async function findBaselineReviewForDocument(documentId: string) {
  return prisma.contractReview.findFirst({
    where: { documentId, comparedAgainstType: "baseline" },
    include: { deviations: true }
  });
}

// Orchestrates a full contract review for an uploaded document: resolves
// whether this is the Main Contractor's first-ever contract (compare
// against SA-2017) or a later one (compare against their most recent prior
// contract, plus an always-run baseline shadow comparison to catch newly-
// introduced SA-2017 drift). Persists ContractReview/ContractDeviation rows
// and the usual suggested-ContractTerms upsert, and returns the PRIMARY
// review (the one shown to the user) with its deviations.
export async function runContractReview(projectId: string, documentId: string) {
  const document = await prisma.contractDocument.findUniqueOrThrow({
    where: { id: documentId },
    include: { project: { select: { mainContractorId: true } } }
  });
  const clauses = await prisma.clause.findMany({ where: { documentId, projectId } });
  const clauseInputs = toClauseInputs(clauses);
  const standardForm = getStandardForm();

  const priorReview = document.project.mainContractorId
    ? await findPriorReview(document.project.mainContractorId, documentId)
    : null;

  // Baseline comparison + contract-terms extraction + required-insurance-
  // cover extraction all run concurrently — none depend on each other, only
  // on the already-extracted clauses. This always runs, regardless of
  // comparison type (see runBaselineComparison).
  const [baseline, extractedTerms, requiredCovers] = await Promise.all([
    runBaselineComparison(clauseInputs),
    extractContractTermsFromClauses(clauses.map((c) => ({ clauseRef: c.clauseRef, title: c.title, body: c.body, pageNumber: c.pageNumber }))),
    extractRequiredInsuranceCoverFromClauses(clauseInputs)
  ]);
  const baselineCounts = countDeviations(baseline.synthesis);

  let primaryReviewId: string;

  if (!priorReview) {
    // First-ever contract for this Main Contractor (or no Main Contractor
    // assigned) — the baseline comparison IS the primary report, exactly as
    // before this feature existed.
    const review = await prisma.contractReview.create({
      data: {
        projectId,
        documentId,
        standardFormVersion: standardForm.version,
        status: "complete",
        comparedAgainstType: "baseline",
        isPrimary: true,
        executiveSummary: baseline.synthesis.executiveSummary,
        overallRiskLevel: baseline.synthesis.overallRiskLevel,
        majorDeviationCount: baselineCounts.majorDeviationCount,
        minorDeviationCount: baselineCounts.minorDeviationCount,
        completedAt: new Date(),
        rawModelOutputs: { bucketResults: baseline.bucketResults, synthesis: baseline.synthesis } as unknown as object,
        deviations: { create: baseline.synthesis.deviations.map(toDeviationCreateInput) }
      }
    });
    primaryReviewId = review.id;
  } else {
    // Later contract — persist the baseline comparison as an internal
    // shadow review (not shown to the user), then run + persist the
    // prior-contract comparison as the primary report.
    const shadowReview = await prisma.contractReview.create({
      data: {
        projectId,
        documentId,
        standardFormVersion: standardForm.version,
        status: "complete",
        comparedAgainstType: "baseline",
        isPrimary: false,
        executiveSummary: baseline.synthesis.executiveSummary,
        overallRiskLevel: baseline.synthesis.overallRiskLevel,
        majorDeviationCount: baselineCounts.majorDeviationCount,
        minorDeviationCount: baselineCounts.minorDeviationCount,
        completedAt: new Date(),
        rawModelOutputs: { bucketResults: baseline.bucketResults, synthesis: baseline.synthesis } as unknown as object,
        deviations: { create: baseline.synthesis.deviations.map(toDeviationCreateInput) }
      }
    });

    // Newly-drifted-from-SA-2017 detection: this document's baseline
    // deviations vs the prior contract's own baseline-tracking deviations,
    // keyed by baselineClauseRef. Absence in the prior set means that
    // clause matched SA-2017 (or was only minor) last time — anything
    // major/missing/additional now that wasn't equally-or-more severe then
    // is new drift.
    const priorBaselineReview = await findBaselineReviewForDocument(priorReview.documentId);
    const severeClassifications = new Set(["major_deviation", "missing_from_subcontract", "additional_in_subcontract"]);
    const priorSevereRefs = new Set(
      (priorBaselineReview?.deviations ?? [])
        .filter((d) => severeClassifications.has(d.classification) && d.baselineClauseRef)
        .map((d) => d.baselineClauseRef as string)
    );
    const newDriftDeviationIds = (
      await prisma.contractDeviation.findMany({
        where: { contractReviewId: shadowReview.id },
        select: { id: true, classification: true, baselineClauseRef: true }
      })
    )
      .filter(
        (d) => severeClassifications.has(d.classification) && d.baselineClauseRef && !priorSevereRefs.has(d.baselineClauseRef)
      )
      .map((d) => d.id);

    if (newDriftDeviationIds.length > 0) {
      await prisma.contractDeviation.updateMany({
        where: { id: { in: newDriftDeviationIds } },
        data: { isNewBaselineDrift: true }
      });
    }

    const priorClauses = await prisma.clause.findMany({ where: { documentId: priorReview.documentId } });
    const priorContractDeviations = await compareClausesToPriorContract(toClauseInputs(priorClauses), clauseInputs);
    const priorContractSynthesis = await synthesizeContractReview(
      [{ topicBucket: "general", deviations: priorContractDeviations }],
      PRIOR_CONTRACT_LABEL
    );
    const priorContractCounts = countDeviations(priorContractSynthesis);

    const primaryReview = await prisma.contractReview.create({
      data: {
        projectId,
        documentId,
        standardFormVersion: standardForm.version,
        status: "complete",
        comparedAgainstType: "prior_contract",
        comparedAgainstReviewId: priorReview.id,
        isPrimary: true,
        newBaselineDriftCount: newDriftDeviationIds.length,
        executiveSummary: priorContractSynthesis.executiveSummary,
        overallRiskLevel: priorContractSynthesis.overallRiskLevel,
        majorDeviationCount: priorContractCounts.majorDeviationCount,
        minorDeviationCount: priorContractCounts.minorDeviationCount,
        completedAt: new Date(),
        rawModelOutputs: { deviations: priorContractDeviations, synthesis: priorContractSynthesis } as unknown as object,
        deviations: { create: priorContractSynthesis.deviations.map(toDeviationCreateInput) }
      }
    });
    primaryReviewId = primaryReview.id;
  }

  // Required insurance cover — replaced wholesale each time this project's
  // contract is (re)reviewed, since it reflects whatever the CURRENTLY
  // governing contract states, not an accumulating history. Compared live
  // against currently-held cover at render time, not stored as a snapshot
  // (see lib/insurance-cover-comparison.ts).
  await prisma.$transaction([
    prisma.contractRequiredCover.deleteMany({ where: { projectId } }),
    ...requiredCovers.map((cover) =>
      prisma.contractRequiredCover.create({
        data: {
          projectId,
          coverType: cover.coverType,
          requiredValue: cover.requiredValue,
          sourceDocumentId: documentId,
          sourceContractReviewId: primaryReviewId
        }
      })
    )
  ]);

  // Suggested ContractTerms — unaffected by comparison type, always sourced
  // from this contract's own extracted terms. Only suggest a field the
  // human hasn't already confirmed a value for.
  const existingTerms = await prisma.contractTerms.findUnique({ where: { projectId } });
  function suggestIfUnconfirmed<T>(realValue: T | null | undefined, extracted: T | null): T | null | undefined {
    return realValue === null || realValue === undefined ? extracted : undefined;
  }
  await prisma.contractTerms.upsert({
    where: { projectId },
    create: {
      projectId,
      sourceDocumentId: documentId,
      sourceContractReviewId: primaryReviewId,
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
      sourceContractReviewId: primaryReviewId,
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
      suggestedDisputeNoticeMethod: suggestIfUnconfirmed(existingTerms?.disputeNoticeMethod, extractedTerms.disputeNoticeMethod),
      suggestedGeneralNoticeMethod: suggestIfUnconfirmed(existingTerms?.generalNoticeMethod, extractedTerms.generalNoticeMethod)
    }
  });

  const finalReview = await prisma.contractReview.findUniqueOrThrow({
    where: { id: primaryReviewId },
    include: {
      deviations: { orderBy: { priorityScore: "desc" } },
      comparedAgainstReview: { include: { document: { select: { title: true, fileName: true, uploadedAt: true } } } }
    }
  });
  const driftDeviations = await getNewBaselineDriftDeviations(
    finalReview.documentId,
    finalReview.comparedAgainstType,
    finalReview.newBaselineDriftCount
  );

  return { ...finalReview, driftDeviations };
}

// The specific clauses behind a prior_contract review's newBaselineDriftCount
// callout — they live on the document's sibling baseline shadow review (see
// runContractReview above), not on the primary review's own deviations,
// since the primary review's deviations are about "changed vs last time,"
// not "deviates from SA-2017."
export async function getNewBaselineDriftDeviations(documentId: string, comparedAgainstType: string, newBaselineDriftCount: number) {
  if (comparedAgainstType !== "prior_contract" || newBaselineDriftCount === 0) return [];
  const shadow = await prisma.contractReview.findFirst({
    where: { documentId, comparedAgainstType: "baseline", isPrimary: false },
    include: { deviations: { where: { isNewBaselineDrift: true }, orderBy: { priorityScore: "desc" } } }
  });
  return shadow?.deviations ?? [];
}

function toDeviationCreateInput(d: SynthesisResult["deviations"][number]) {
  return {
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
  };
}
