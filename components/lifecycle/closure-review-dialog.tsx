"use client";

import { useState } from "react";

export type ClosureCheck = { label: string; count: number };

// Shared by every "Close" action in the app (Site Instruction/Variation,
// Task, Project) — one component rendering the brief's own "2 Tasks remain
// open, 1 Variation is pending... are you sure?" pattern, with an optional
// reason and an explicit override. Warnings inform, they never hard-block:
// the Close button is always clickable, just relabelled "Close Anyway"
// when something's outstanding.
export function ClosureReviewDialog({
  title,
  description,
  checks,
  isLoading,
  onCancel,
  onConfirm
}: {
  title: string;
  description?: string;
  checks: ClosureCheck[] | null;
  isLoading: boolean;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasWarnings = (checks ?? []).some((c) => c.count > 0);

  async function handleConfirm() {
    setIsSubmitting(true);
    await onConfirm(note.trim() || undefined!);
    setIsSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="relative w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 p-5 shadow-lg">
        <h3 className="text-sm font-bold mb-1">{title}</h3>
        {description && <p className="text-xs text-[#4c739a] dark:text-slate-400 mb-3">{description}</p>}

        {isLoading || !checks ? (
          <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-4">Checking linked items...</p>
        ) : (
          <div className="flex flex-col gap-1.5 mb-4">
            {checks.map((check) => (
              <div key={check.label} className="flex items-center justify-between text-sm">
                <span className="text-[#4c739a] dark:text-slate-400">{check.label}</span>
                <span
                  className={`font-bold ${
                    check.count > 0 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"
                  }`}
                >
                  {check.count}
                </span>
              </div>
            ))}
            {hasWarnings && (
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
                Outstanding items remain — you can still close this, but it's worth checking first.
              </p>
            )}
          </div>
        )}

        <label className="flex flex-col gap-1 text-xs font-medium mb-4">
          Reason <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional, kept in the history)</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            className="rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="h-9 px-3 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-medium disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting || isLoading}
            className="h-9 px-3 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
          >
            {isSubmitting ? "Closing..." : hasWarnings ? "Close Anyway" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
