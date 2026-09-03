"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RetentionSummary } from "@/lib/retention";

function formatCurrency(amount: number) {
  return amount.toLocaleString("en-NZ", { style: "currency", currency: "NZD" });
}
function formatDate(date: Date | string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}
function toInputDate(date: Date | string | null) {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

type Tranche = RetentionSummary["tranche1"];

// One tranche's editable state — percent (of the total withheld), an
// expected date (defaults are pre-computed server-side by
// getRetentionSummary, this just edits whatever value it was given), and
// marking it released (amount + date together, since "released with no
// amount recorded" isn't a state worth allowing — see the PATCH route's
// own comment).
function TrancheEditor({
  label,
  tranche,
  onSave
}: {
  label: string;
  tranche: Tranche;
  onSave: (patch: { percent?: number | null; expectedDate?: string | null; releasedAmount?: number | null; releasedAt?: string | null }) => Promise<void>;
}) {
  const [percent, setPercent] = useState(tranche.percent != null ? String(tranche.percent) : "");
  const [expectedDate, setExpectedDate] = useState(toInputDate(tranche.expectedDate));
  const [releasedAmount, setReleasedAmount] = useState(tranche.releasedAmount != null ? String(tranche.releasedAmount) : "");
  const [releasedDate, setReleasedDate] = useState(toInputDate(tranche.releasedAt));
  const [isSaving, setIsSaving] = useState(false);
  const isReleased = tranche.releasedAt != null;

  async function saveSetup() {
    setIsSaving(true);
    await onSave({ percent: percent ? Number(percent) : null, expectedDate: expectedDate || null });
    setIsSaving(false);
  }

  async function markReleased() {
    if (!releasedAmount || !releasedDate) return;
    setIsSaving(true);
    await onSave({ releasedAmount: Number(releasedAmount), releasedAt: releasedDate });
    setIsSaving(false);
  }

  async function undoReleased() {
    setIsSaving(true);
    await onSave({ releasedAmount: null, releasedAt: null });
    setIsSaving(false);
  }

  return (
    <div className="rounded-lg border border-[#e7edf3] dark:border-slate-700 p-3 flex flex-col gap-2 flex-1 min-w-[16rem]">
      <p className="text-xs font-bold uppercase tracking-wide text-[#4c739a] dark:text-slate-400">{label}</p>

      <div className="flex gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium w-24">
          Share %
          <input
            type="number"
            min={0}
            max={100}
            value={percent}
            onChange={(event) => setPercent(event.target.value)}
            onBlur={saveSetup}
            disabled={isSaving || isReleased}
            className="h-8 rounded-md border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs disabled:opacity-60"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium flex-1">
          Expected date
          <input
            type="date"
            value={expectedDate}
            onChange={(event) => setExpectedDate(event.target.value)}
            onBlur={saveSetup}
            disabled={isSaving || isReleased}
            className="h-8 rounded-md border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs disabled:opacity-60"
          />
        </label>
      </div>

      <p className="text-xs text-[#4c739a] dark:text-slate-400">
        Expected: {tranche.expectedAmount != null ? formatCurrency(tranche.expectedAmount) : "—"}
      </p>

      {isReleased ? (
        <div className="flex items-center justify-between text-xs">
          <span className="text-green-700 dark:text-green-400 font-medium">
            Released {formatCurrency(Number(tranche.releasedAmount)) } on {formatDate(tranche.releasedAt)}
          </span>
          <button type="button" onClick={undoReleased} disabled={isSaving} className="text-[#4c739a] hover:underline disabled:opacity-60">
            Undo
          </button>
        </div>
      ) : (
        <div className="flex gap-2 items-end">
          <label className="flex flex-col gap-1 text-xs font-medium w-28">
            Released $
            <input
              type="number"
              min={0}
              step="0.01"
              value={releasedAmount}
              onChange={(event) => setReleasedAmount(event.target.value)}
              className="h-8 rounded-md border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium w-32">
            On
            <input
              type="date"
              value={releasedDate}
              onChange={(event) => setReleasedDate(event.target.value)}
              className="h-8 rounded-md border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs"
            />
          </label>
          <button
            type="button"
            onClick={markReleased}
            disabled={isSaving || !releasedAmount || !releasedDate}
            className="h-8 px-3 rounded-md bg-primary text-white text-xs font-bold hover:bg-primary/90 disabled:opacity-60"
          >
            Mark released
          </button>
        </div>
      )}
    </div>
  );
}

export function RetentionCard({ projectId, summary }: { projectId: string; summary: RetentionSummary }) {
  const router = useRouter();

  async function patch(fields: Record<string, unknown>) {
    await fetch(`/api/projects/${projectId}/retention`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields)
    });
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-[#e7edf3] dark:border-slate-700 p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold">Retention</h3>
          <p className="text-xs text-[#4c739a] dark:text-slate-400">
            {summary.retentionPercent}% of every claim, computed automatically from what's actually been claimed.
          </p>
        </div>
        <p className="text-xl font-bold">{formatCurrency(summary.totalWithheld)}</p>
      </div>

      {summary.retentionPercent === 0 && (
        <p className="text-xs rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 p-2">
          No retention percentage is set for this project yet — set it under Contract → Contract Terms.
        </p>
      )}

      <p className="text-xs text-[#4c739a] dark:text-slate-400">
        Practical Completion: {formatDate(summary.practicalCompletionDate)}
        {!summary.practicalCompletionDate && " (mark the project Completed, or set an override below, to enable tranche dates)"}
      </p>

      <div className="flex flex-wrap gap-3">
        <TrancheEditor
          label="Tranche 1 — at Practical Completion"
          tranche={summary.tranche1}
          onSave={(patchFields) =>
            patch({
              tranche1Percent: patchFields.percent,
              tranche1ExpectedDate: patchFields.expectedDate,
              tranche1ReleasedAmount: patchFields.releasedAmount,
              tranche1ReleasedAt: patchFields.releasedAt
            })
          }
        />
        <TrancheEditor
          label="Tranche 2 — end of Defects Liability Period"
          tranche={summary.tranche2}
          onSave={(patchFields) =>
            patch({
              tranche2Percent: patchFields.percent,
              tranche2ExpectedDate: patchFields.expectedDate,
              tranche2ReleasedAmount: patchFields.releasedAmount,
              tranche2ReleasedAt: patchFields.releasedAt
            })
          }
        />
      </div>
    </div>
  );
}
