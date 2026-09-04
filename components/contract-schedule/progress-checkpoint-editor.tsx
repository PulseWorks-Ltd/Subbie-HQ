"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ContractItemProgressEntry } from "@prisma/client";

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

// Pre-Launch Feature 6 — split what used to be one combined "History"
// panel (log list + add-checkpoint form together) into two separate
// pieces: a fast inline entry that's always one click away (no form to
// open first), and a History view that shows ONLY the log, never the
// entry form mixed in. Both still call the same progress API and accept
// the same phaseId/componentId pair (see lib/contract-schedule.ts for why
// one shape covers both a fixed component's phase and a weekly_hire
// component).

// Always-visible, single-field fast entry — dated today, since the whole
// point is "record today's % right now" without picking a date first.
// A user who genuinely needs a backdated/edited entry still has History's
// own delete-and-re-add, or can use this same control after changing
// nothing else; a full date picker was deliberately dropped from the
// fast path to keep it a true one-click action.
export function QuickPercentEntry({
  projectId,
  phaseId,
  componentId,
  currentPercent,
  percentLabel
}: {
  projectId: string;
  phaseId?: string;
  componentId?: string;
  currentPercent: number;
  percentLabel: string;
}) {
  const router = useRouter();
  const [percent, setPercent] = useState(String(currentPercent));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    const value = Number(percent);
    if (percent === "" || Number.isNaN(value) || value < 0 || value > 100) {
      setError("0-100 only");
      return;
    }
    if (value === currentPercent) return; // nothing changed — skip a no-op checkpoint
    setIsSaving(true);
    const response = await fetch(`/api/projects/${projectId}/contract-schedule/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phaseId, componentId, effectiveDate: new Date().toISOString().slice(0, 10), percent: value })
    });
    setIsSaving(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(typeof body?.error === "string" ? body.error : "Could not save.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min={0}
        max={100}
        value={percent}
        onChange={(event) => setPercent(event.target.value)}
        onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); handleSave(); } }}
        aria-label={percentLabel}
        className="h-7 w-16 rounded-md border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 text-xs text-right"
      />
      <span className="text-xs text-[#4c739a] dark:text-slate-400">%</span>
      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving || percent === String(currentPercent)}
        className="h-7 px-2 rounded-md bg-primary text-white text-xs font-bold hover:bg-primary/90 disabled:opacity-40"
      >
        {isSaving ? "..." : "Save"}
      </button>
      {error && <span className="text-[10px] text-red-600">{error}</span>}
    </div>
  );
}

// History — toggled open, shows ONLY the dated log (no add-checkpoint
// form mixed in, unlike this component's previous combined version).
export function ProgressHistory({
  projectId,
  entries,
  percentLabel
}: {
  projectId: string;
  entries: ContractItemProgressEntry[];
  percentLabel: string;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const sorted = [...entries].sort((a, b) => new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime());

  async function handleDelete(entryId: string) {
    if (!confirm("Remove this checkpoint?")) return;
    await fetch(`/api/projects/${projectId}/contract-schedule/progress/${entryId}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="text-xs font-medium text-primary hover:underline self-start"
      >
        {isOpen ? "Hide history" : `History (${entries.length})`}
      </button>

      {isOpen && (
        <div className="rounded-lg border border-[#e7edf3] dark:border-slate-700 p-3">
          {sorted.length === 0 ? (
            <p className="text-xs text-[#4c739a] dark:text-slate-400">No checkpoints recorded yet — {percentLabel} is 0%.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {sorted.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between text-xs">
                  <span>
                    {formatDate(entry.effectiveDate)} — <span className="font-bold">{entry.percent}%</span>
                    {entry.note ? <span className="text-[#4c739a] dark:text-slate-400"> · {entry.note}</span> : null}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(entry.id)}
                    className="text-[#4c739a] hover:text-red-600 dark:text-slate-400"
                    aria-label="Delete checkpoint"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
