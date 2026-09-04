"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RetentionSummary, RetentionStatus } from "@/lib/retention";
import type { RetentionReleaseTrigger } from "@prisma/client";

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

// Plain-English phrasing for each trigger — used both in the completion-
// confirmation prompt and the generated summary sentence, so the two
// never describe the same trigger two different ways.
const TRIGGER_LABELS: Record<RetentionReleaseTrigger, string> = {
  completion_of_subcontract_works: "completion of your Subcontract Works",
  practical_completion_subcontractor: "practical completion of your own scope",
  final_payment_claim: "your final payment claim",
  final_account: "the final account",
  head_contract_event: "an event under the head contract (not your own performance)",
  other_event: "another contractual event",
  not_stated: "a trigger your contract doesn't clearly state"
};

const STATUS_LABELS: Record<RetentionStatus, { label: string; color: string }> = {
  not_configured: { label: "Not configured", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  accumulating: { label: "Accumulating", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  awaiting_completion: { label: "Awaiting completion", color: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300" },
  initial_release_due: { label: "Initial release due", color: "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300" },
  initial_release_overdue: { label: "Initial release overdue", color: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300" },
  in_defects_period: { label: "Defects period", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  final_release_due: { label: "Final release due", color: "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300" },
  final_release_overdue: { label: "Final release overdue", color: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300" },
  fully_released: { label: "Fully released", color: "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300" }
};

// The default, simple presentation (Retention V2 plan §9.2) — generated
// directly from the real extracted/confirmed values, never a generic
// assumption rendered as fact. Returns null when there isn't enough real
// information to say anything more specific than the raw numbers already
// shown elsewhere on the card.
function buildSummarySentence(summary: RetentionSummary): string | null {
  if (!summary.retentionApplies || !summary.retentionPercent) return null;
  const parts = [`${summary.retentionPercent}% retained from progress payments.`];
  if (summary.tranche1.percent != null && summary.initialReleaseTrigger) {
    parts.push(`Initial release: ${summary.tranche1.percent}% on ${TRIGGER_LABELS[summary.initialReleaseTrigger]}.`);
  }
  if (summary.tranche2.percent != null) {
    parts.push(`Remaining retention: ${summary.tranche2.percent}%.`);
  }
  return parts.join(" ");
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

// The explicit "Confirm completion" action (Retention V2 plan §6.1) —
// trigger-aware copy sourced from the real extracted/confirmed trigger,
// pre-filled from whatever completion date is already known (an override
// or Project.completedAt), editable, with an optional note for how this
// is actually known (e.g. "per the Contractor's clause 10.4.2(a) notice").
function CompletionConfirmation({ projectId, summary }: { projectId: string; summary: RetentionSummary }) {
  const router = useRouter();
  const [date, setDate] = useState(toInputDate(summary.completionOfWorksDate));
  const [note, setNote] = useState(summary.completionOfWorksNote ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const triggerLabel = summary.initialReleaseTrigger ? TRIGGER_LABELS[summary.initialReleaseTrigger] : null;

  async function confirm() {
    if (!date) return;
    setIsSaving(true);
    await fetch(`/api/projects/${projectId}/retention/confirm-completion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmedAt: date, note: note || null })
    });
    setIsSaving(false);
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-[#e7edf3] dark:border-slate-700 p-3 flex flex-col gap-2">
      <p className="text-sm font-medium">
        {triggerLabel
          ? `Your contract ties your initial retention release to ${triggerLabel}. Have the Subcontract Works been completed?`
          : "Confirm when your Subcontract Works were completed to start the retention release timers."}
      </p>
      {summary.completionOfWorksConfirmedAt && (
        <p className="text-xs text-green-700 dark:text-green-400">
          Confirmed as {formatDate(summary.completionOfWorksConfirmedAt)}.
        </p>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium">
          Completion date
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="h-9 rounded-md border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium flex-1 min-w-[12rem]">
          Note <span className="text-[#4c739a] dark:text-slate-400">(optional — e.g. how you know)</span>
          <input
            type="text"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="h-9 rounded-md border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={confirm}
          disabled={isSaving || !date}
          className="h-9 px-3 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
        >
          {summary.completionOfWorksConfirmedAt ? "Update confirmation" : "Confirm completion"}
        </button>
      </div>
    </div>
  );
}

export function RetentionCard({ projectId, summary }: { projectId: string; summary: RetentionSummary }) {
  const router = useRouter();
  const summarySentence = buildSummarySentence(summary);
  const statusInfo = STATUS_LABELS[summary.status];

  async function patch(fields: Record<string, unknown>) {
    await fetch(`/api/projects/${projectId}/retention`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields)
    });
    router.refresh();
  }

  if (summary.status === "not_configured") {
    return (
      <div className="rounded-xl border border-[#e7edf3] dark:border-slate-700 p-4">
        <h3 className="text-sm font-bold mb-1">Retention</h3>
        <p className="text-xs text-[#4c739a] dark:text-slate-400">
          No retention applies to this project (or hasn't been configured yet) — set it under Contract → Contract Terms.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#e7edf3] dark:border-slate-700 p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold">Retention</h3>
            <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${statusInfo.color}`}>{statusInfo.label}</span>
          </div>
          <p className="text-xs text-[#4c739a] dark:text-slate-400 mt-0.5">
            {summarySentence ?? `${summary.retentionPercent}% of every claim, computed automatically from what's actually been claimed.`}
          </p>
        </div>
        <p className="text-xl font-bold">{formatCurrency(summary.totalWithheld)}</p>
      </div>

      {summary.requiresReview && (
        <p className="text-xs rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 p-2">
          This provision may require review under the Construction Contracts Act 2002 — see below.
          {summary.reviewNotes && <span className="block mt-1">{summary.reviewNotes}</span>}
        </p>
      )}

      <p className="text-xs text-[#4c739a] dark:text-slate-400">
        Subbie HQ will notify you when your retention release dates are approaching or become due.
      </p>

      <CompletionConfirmation projectId={projectId} summary={summary} />

      <div className="flex flex-wrap gap-3">
        <TrancheEditor
          label="Tranche 1 — initial release"
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
