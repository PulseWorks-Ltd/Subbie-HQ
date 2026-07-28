"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ContractDeviation, ContractReview } from "@prisma/client";
import { ReviewProgress } from "@/components/contract/review-progress";
import { DeviationReportView } from "@/components/contract/deviation-report-view";

type ReviewWithDeviations = ContractReview & { deviations: ContractDeviation[] };

export function ContractReviewSection({
  projectId,
  documentId,
  initialReview
}: {
  projectId: string;
  documentId: string;
  initialReview: ReviewWithDeviations | null;
}) {
  const router = useRouter();
  const [review, setReview] = useState<ReviewWithDeviations | null>(initialReview);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
            Compares this document against the SA-2017 standard-form subcontract agreement.
          </p>
        </div>
        {!isRunning && (
          <button
            onClick={runReview}
            className="h-8 px-3 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 shrink-0"
          >
            {review ? "Re-run Review" : "Run Contract Review"}
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {isRunning ? (
        <ReviewProgress />
      ) : review ? (
        <DeviationReportView review={review} />
      ) : (
        <p className="text-sm text-[#4c739a] dark:text-slate-400">
          No review has been run yet for this document.
        </p>
      )}
    </div>
  );
}
