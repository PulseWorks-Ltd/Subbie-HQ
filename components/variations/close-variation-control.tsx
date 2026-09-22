"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClosureReviewDialog, type ClosureCheck } from "@/components/lifecycle/closure-review-dialog";

const CHECK_LABELS: Record<string, string> = {
  "Open linked Tasks": "Open linked Tasks",
  "Unclaimed Variation balance": "Unclaimed Variation balance",
  "Unsigned Day Works sheets": "Unsigned Day Works sheets"
};

// The Close action + its mandatory warnings-review dialog — factored out
// of VariationItemLifecycleControls (the detail page's own close/
// reactivate/history panel) so the exact same review-then-confirm flow
// can be reused wherever a "Close" button is wanted, without duplicating
// the review-fetch/force-confirm logic. Currently used by the detail
// page's own controls AND the Variations list card's quick-close button —
// both call the identical API, so closing from the list is never a
// shortcut that skips the same open-Tasks/unclaimed-balance/unsigned-
// Day-Works checks the detail page shows.
export function CloseVariationControl({
  projectId,
  itemId,
  className
}: {
  projectId: string;
  itemId: string;
  className?: string;
}) {
  const router = useRouter();
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isLoadingReview, setIsLoadingReview] = useState(false);
  const [checks, setChecks] = useState<ClosureCheck[] | null>(null);

  async function openReview() {
    setIsReviewOpen(true);
    setIsLoadingReview(true);
    const response = await fetch(`/api/projects/${projectId}/variation-items/${itemId}/close`);
    const body = await response.json().catch(() => null);
    setIsLoadingReview(false);
    setChecks(body?.review?.checks ?? []);
  }

  async function handleClose(note?: string) {
    const hasWarnings = (checks ?? []).some((c) => c.count > 0);
    const response = await fetch(`/api/projects/${projectId}/variation-items/${itemId}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force: hasWarnings, note })
    });
    if (response.ok) {
      setIsReviewOpen(false);
      router.refresh();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openReview}
        className={
          className ??
          "h-9 px-3 rounded-lg border border-red-300 dark:border-red-900/40 text-red-600 dark:text-red-400 text-sm font-bold hover:bg-red-50 dark:hover:bg-red-900/20"
        }
      >
        Close
      </button>

      {isReviewOpen && (
        <ClosureReviewDialog
          title="Close this item?"
          description="Removes it from your active lists — it stays fully accessible in history and can be reactivated at any time."
          checks={checks?.map((c) => ({ label: CHECK_LABELS[c.label] ?? c.label, count: c.count })) ?? null}
          isLoading={isLoadingReview}
          onCancel={() => setIsReviewOpen(false)}
          onConfirm={handleClose}
        />
      )}
    </>
  );
}
