"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { VariationItem } from "@prisma/client";

// Logging a delay event is deliberately the only thing this dialog does —
// notice drafting/sending and resolution are separate actions on the
// detail page, once the event actually exists (mirroring how a Contract
// Item is added first, then its progress is recorded separately).
export function DelayEventFormDialog({
  projectId,
  taggableItems,
  open,
  onClose
}: {
  projectId: string;
  taggableItems: Pick<VariationItem, "id" | "reference" | "title">[];
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [cause, setCause] = useState("");
  const [clauseReference, setClauseReference] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [daysClaimed, setDaysClaimed] = useState("");
  const [variationItemId, setVariationItemId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) return null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const response = await fetch(`/api/projects/${projectId}/delay-events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cause,
        clauseReference: clauseReference || null,
        startDate,
        endDate: endDate || null,
        daysClaimed: daysClaimed ? Number(daysClaimed) : null,
        variationItemId: variationItemId || null
      })
    });

    setIsSubmitting(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(typeof body?.error === "string" ? body.error : "Could not log this delay event.");
      return;
    }

    const { delayEvent } = await response.json();
    onClose();
    router.push(`/projects/${projectId}/delay-events/${delayEvent.id}`);
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="relative w-full max-w-md rounded-xl bg-white dark:bg-slate-900 p-6 shadow-lg max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 rounded-lg p-1 text-[#4c739a] hover:bg-[#e7edf3] dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>
        <h2 className="text-lg font-bold mb-1">Log a delay event</h2>
        <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-5">
          The notice deadline is worked out automatically from Contract Terms' delay notice period, once set — editable afterward.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Cause
            <input
              type="text"
              required
              value={cause}
              onChange={(event) => setCause(event.target.value)}
              placeholder="e.g. Inclement weather, access restricted by principal"
              className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>

          <div className="flex gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium flex-1">
              Start date
              <input
                type="date"
                required
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium flex-1">
              End date <span className="font-normal text-[#4c739a] dark:text-slate-400">(if known)</span>
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>
          </div>

          <div className="flex gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium flex-1">
              Clause reference <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span>
              <input
                type="text"
                value={clauseReference}
                onChange={(event) => setClauseReference(event.target.value)}
                placeholder="e.g. Clause 10.1"
                className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium w-32">
              Days claimed <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span>
              <input
                type="number"
                min={0}
                value={daysClaimed}
                onChange={(event) => setDaysClaimed(event.target.value)}
                className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>
          </div>

          {taggableItems.length > 0 && (
            <label className="flex flex-col gap-1 text-sm font-medium">
              Linked Site Instruction / Variation <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span>
              <select
                value={variationItemId}
                onChange={(event) => setVariationItemId(event.target.value)}
                className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">None</option>
                {taggableItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.reference} — {item.title}
                  </option>
                ))}
              </select>
            </label>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 justify-end mt-2">
            <button type="button" onClick={onClose} className="h-10 px-4 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-medium">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
            >
              {isSubmitting ? "Saving..." : "Log delay event"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
