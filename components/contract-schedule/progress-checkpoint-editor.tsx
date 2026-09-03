"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ContractItemProgressEntry } from "@prisma/client";

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

// One dated %-checkpoint history, shared by a fixed component's phase
// (point-in-time % complete) and a weekly_hire component (day-weighted %
// on hire) — the only difference the caller passes in is which of
// phaseId/componentId to attach a new checkpoint to; the display and add/
// delete mechanics are identical either way (see lib/contract-schedule.ts
// for why the same shape works for both).
export function ProgressCheckpointEditor({
  projectId,
  phaseId,
  componentId,
  entries,
  percentLabel
}: {
  projectId: string;
  phaseId?: string;
  componentId?: string;
  entries: ContractItemProgressEntry[];
  percentLabel: string;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [percent, setPercent] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sorted = [...entries].sort((a, b) => new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime());

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (percent === "" || Number(percent) < 0 || Number(percent) > 100) {
      setError("Enter a percentage between 0 and 100.");
      return;
    }
    setIsSubmitting(true);
    const response = await fetch(`/api/projects/${projectId}/contract-schedule/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phaseId, componentId, effectiveDate, percent: Number(percent), note: note || undefined })
    });
    setIsSubmitting(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(typeof body?.error === "string" ? body.error : "Could not save.");
      return;
    }
    setPercent("");
    setNote("");
    router.refresh();
  }

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
        {isOpen ? "Hide" : `History (${entries.length})`}
      </button>

      {isOpen && (
        <div className="flex flex-col gap-2 rounded-lg border border-[#e7edf3] dark:border-slate-700 p-3">
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

          <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2 pt-1 border-t border-[#e7edf3] dark:border-slate-700">
            <label className="flex flex-col gap-0.5 text-xs font-medium">
              Date
              <input
                type="date"
                value={effectiveDate}
                onChange={(event) => setEffectiveDate(event.target.value)}
                className="h-8 rounded-md border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs"
              />
            </label>
            <label className="flex flex-col gap-0.5 text-xs font-medium w-20">
              {percentLabel} %
              <input
                type="number"
                min={0}
                max={100}
                value={percent}
                onChange={(event) => setPercent(event.target.value)}
                className="h-8 rounded-md border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs"
              />
            </label>
            <label className="flex flex-col gap-0.5 text-xs font-medium flex-1 min-w-[8rem]">
              Note <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span>
              <input
                type="text"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="h-8 rounded-md border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs"
              />
            </label>
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-8 px-3 rounded-md bg-primary text-white text-xs font-bold hover:bg-primary/90 disabled:opacity-60"
            >
              Add
            </button>
          </form>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
