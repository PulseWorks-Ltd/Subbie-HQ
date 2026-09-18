"use client";

import { useState } from "react";
import Link from "next/link";
import type { CommercialReviewFeedItem } from "@/lib/commercial-review";

function formatTimestamp(date: Date) {
  return new Date(date).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

// Card shell matches dashboard-item-row.tsx/update-dashboard-row.tsx
// exactly (bg-white rounded-xl border p-4 flex items-start gap-3) for
// visual consistency across every dashboard section — no new visual
// system introduced for this one.
export function CommercialReviewItemRow({
  item,
  onResolved
}: {
  item: CommercialReviewFeedItem;
  onResolved: (id: string) => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patchUpdate(body: Record<string, unknown>) {
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${item.projectId}/updates/${item.updateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Couldn't update this entry.");
      }
      onResolved(item.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update this entry.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleNoActionRequired() {
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${item.projectId}/commercial-review/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "no_action_required" })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Couldn't update this item.");
      }
      onResolved(item.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update this item.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const reasonLabel =
    item.pendingReason === "awaiting_percentage"
      ? "Tagged Contract Work — needs a % complete"
      : "Not yet assigned to a commercial record";

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#e7edf3] dark:border-slate-800 p-4 flex items-start gap-3">
      <span className="material-symbols-outlined text-xl mt-0.5 shrink-0 text-[#4c739a] dark:text-slate-400">
        assignment_late
      </span>

      <div className="flex-1 min-w-0">
        <Link href={item.href} className="block hover:underline">
          <p className="text-sm leading-snug">
            <span className="font-bold">{item.authorName}</span> — {item.bodyPreview}
          </p>
        </Link>
        <p className="text-xs text-[#4c739a] dark:text-slate-400 mt-1">
          {item.projectName} · {formatTimestamp(item.createdAt)}
        </p>
        <p className="text-xs text-[#4c739a] dark:text-slate-400 mt-1">
          {item.aiSummary || reasonLabel}
        </p>

        {(item.attachmentCount > 0 || item.hasRelatedCorrespondence || item.hasAdditionalWorkLanguage) && (
          <p className="flex items-center gap-3 mt-2 flex-wrap">
            {item.hasAdditionalWorkLanguage && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                Scope-change wording
              </span>
            )}
            {item.attachmentCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-[#4c739a] dark:text-slate-400">
                <span className="material-symbols-outlined text-sm">attach_file</span>
                {item.attachmentCount}
              </span>
            )}
            {item.hasRelatedCorrespondence && (
              <span className="inline-flex items-center gap-1 text-[11px] text-[#4c739a] dark:text-slate-400">
                <span className="material-symbols-outlined text-sm">mail</span>
                Correspondence sent
              </span>
            )}
          </p>
        )}

        {error && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{error}</p>}

        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <Link
            href={item.href}
            className="h-8 px-3 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 flex items-center"
          >
            Review
          </Link>
          {item.pendingReason === "unassigned" && (
            <button
              onClick={() => patchUpdate({ category: "general" })}
              disabled={isSubmitting}
              className="h-8 px-3 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-xs font-bold hover:bg-[#e7edf3] dark:hover:bg-slate-800 disabled:opacity-60"
            >
              Mark as General
            </button>
          )}
          <button
            onClick={handleNoActionRequired}
            disabled={isSubmitting}
            className="h-8 px-3 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-xs font-bold hover:bg-[#e7edf3] dark:hover:bg-slate-800 disabled:opacity-60"
          >
            No Action Required
          </button>
        </div>
      </div>
    </div>
  );
}
