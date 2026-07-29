"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ContractDeviation, ContractDocument, ContractReview, DocumentProcessingStatus } from "@prisma/client";
import { ReviewProgress } from "@/components/contract/review-progress";
import { DeviationReportView } from "@/components/contract/deviation-report-view";

export type ReviewWithChain = ContractReview & {
  deviations: ContractDeviation[];
  comparedAgainstReview:
    | (ContractReview & { document: Pick<ContractDocument, "title" | "fileName" | "uploadedAt"> })
    | null;
  driftDeviations: ContractDeviation[];
};

export function ContractReviewSection({
  projectId,
  documentId,
  initialReview,
  hasClauses,
  processingStatus,
  processingError
}: {
  projectId: string;
  documentId: string;
  initialReview: ReviewWithChain | null;
  hasClauses: boolean;
  processingStatus: DocumentProcessingStatus;
  processingError: string | null;
}) {
  const router = useRouter();
  const [review, setReview] = useState<ReviewWithChain | null>(initialReview);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setReview(initialReview);
  }, [initialReview]);

  // Background clause extraction (kicked off at upload time) is still in
  // progress — poll until it finishes so the button unlocks on its own.
  const isBackgroundProcessing = !hasClauses && processingStatus === "processing";

  useEffect(() => {
    if (!isBackgroundProcessing) return;
    const interval = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(interval);
  }, [isBackgroundProcessing, router]);

  async function runReview() {
    setIsRunning(true);
    setError(null);

    const response = await fetch(`/api/projects/${projectId}/contract-documents/${documentId}/review`, {
      method: "POST"
    });
    const body = await response.json().catch(() => null);

    setIsRunning(false);

    if (!response.ok) {
      setError(typeof body?.error === "string" ? body.error : "Could not run the contract review.");
      if (body?.review) setReview(body.review);
      router.refresh();
      return;
    }

    setReview(body.review);
    router.refresh();
  }

  return (
    <div className="mt-5 pt-4 border-t border-[#e7edf3] dark:border-slate-800">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-bold">Contract Review</h4>
          <p className="text-xs text-[#4c739a] dark:text-slate-400">
            Compares this document against the SA-2017 standard-form subcontract agreement, or this Main
            Contractor's previous contract once one exists.
          </p>
        </div>
        {!isRunning && (
          <button
            onClick={runReview}
            disabled={isBackgroundProcessing}
            title={isBackgroundProcessing ? "This document is still being processed automatically." : undefined}
            className="h-8 px-3 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary/10"
          >
            {review ? "Re-run Review" : "Run Contract Review"}
          </button>
        )}
      </div>

      {isBackgroundProcessing && (
        <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-3">
          Processing this document automatically (extracting text, and running OCR if needed) — this page will
          update on its own once it's ready to review. This can take a little while for longer documents.
        </p>
      )}

      {!hasClauses && !isBackgroundProcessing && processingStatus === "failed" && processingError && (
        <p className="text-sm text-amber-600 dark:text-amber-400 mb-3">{processingError}</p>
      )}

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {isRunning ? (
        <ReviewProgress />
      ) : review ? (
        <DeviationReportView projectId={projectId} documentId={documentId} review={review} />
      ) : (
        !isBackgroundProcessing && (
          <p className="text-sm text-[#4c739a] dark:text-slate-400">
            No review has been run yet for this document.
          </p>
        )
      )}
    </div>
  );
}
