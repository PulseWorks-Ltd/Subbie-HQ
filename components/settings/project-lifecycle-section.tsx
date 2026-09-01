"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClosureReviewDialog, type ClosureCheck } from "@/components/lifecycle/closure-review-dialog";

const STATUS_LABELS: Record<string, string> = { active: "Active", completed: "Completed", closed: "Closed" };

// Complete (physical/site work finished) and Close (commercial/admin
// resolved) are separate, non-automatic transitions — completing never
// implies closing. Reuses the same ClosureReviewDialog as a Site
// Instruction/Variation's own Close action, with the project-wide rollup
// (§15.3's own worked example) as its checks.
export function ProjectLifecycleSection({ projectId, status }: { projectId: string; status: string }) {
  const router = useRouter();
  const [isCompleting, setIsCompleting] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isLoadingReview, setIsLoadingReview] = useState(false);
  const [checks, setChecks] = useState<ClosureCheck[] | null>(null);

  async function handleComplete() {
    setIsCompleting(true);
    await fetch(`/api/projects/${projectId}/lifecycle/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    setIsCompleting(false);
    router.refresh();
  }

  async function openReview() {
    setIsReviewOpen(true);
    setIsLoadingReview(true);
    const response = await fetch(`/api/projects/${projectId}/lifecycle/close`);
    const body = await response.json().catch(() => null);
    setIsLoadingReview(false);
    const review = body?.review;
    setChecks(
      review
        ? [
            { label: "Site Instructions not yet closed", count: review.siTotal - review.siClosed },
            { label: "Variations pending", count: review.variationPending },
            { label: "Day Works awaiting signature", count: review.dayWorksAwaitingSignature },
            { label: "Tasks open", count: review.taskOpen },
            { label: "Claims outstanding", count: review.claimsOutstanding }
          ]
        : []
    );
  }

  async function handleClose(note?: string) {
    const hasWarnings = (checks ?? []).some((c) => c.count > 0);
    const response = await fetch(`/api/projects/${projectId}/lifecycle/close`, {
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
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#cfdbe7] dark:border-slate-800 p-5 flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-bold">Project Lifecycle</h3>
        <p className="text-xs text-[#4c739a] dark:text-slate-400">
          Current status: <strong>{STATUS_LABELS[status] ?? status}</strong>. Completed (physical work finished) and
          Closed (commercial/admin resolved) are separate — completing never automatically closes the project.
        </p>
      </div>
      <div className="flex gap-2">
        {status === "active" && (
          <button
            onClick={handleComplete}
            disabled={isCompleting}
            className="h-9 px-3 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-bold hover:bg-[#e7edf3] dark:hover:bg-slate-800 disabled:opacity-60"
          >
            {isCompleting ? "Marking Complete..." : "Mark Physically Complete"}
          </button>
        )}
        {status !== "closed" && (
          <button
            onClick={openReview}
            className="h-9 px-3 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-bold hover:bg-[#e7edf3] dark:hover:bg-slate-800"
          >
            Close Project
          </button>
        )}
      </div>

      {isReviewOpen && (
        <ClosureReviewDialog
          title="Close this project?"
          checks={checks}
          isLoading={isLoadingReview}
          onCancel={() => setIsReviewOpen(false)}
          onConfirm={handleClose}
        />
      )}
    </div>
  );
}
