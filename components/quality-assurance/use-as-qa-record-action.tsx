"use client";

import { useState } from "react";
import Link from "next/link";

export type QaRecordSource = { type: "update-attachment" | "variation-photo"; id: string };
export type TaggableItem = { id: string; reference: string; title: string };

type Step =
  | { name: "closed" }
  | { name: "picker" }
  | { name: "working" }
  | { name: "saved" };

// Non-destructive by design (same as UseAsDayWorksSheetAction, Task 3.1):
// this only ever POSTs a *reference* to an existing Update attachment or
// Pictures-tab photo — the source file itself is never touched, moved, or
// deleted. The server copies its bytes to a brand-new S3 object per created
// QA record (see the qa-records POST route), so running this action against
// the same source more than once is always safe. Unlike Day Works, there's
// no AI extraction step (Task 3.2) — the user enters the stage label and
// notes directly here, and the record is saved in one step.
export function UseAsQaRecordAction({
  projectId,
  source,
  taggableItems,
  defaultVariationItemId,
  variant = "icon",
  onTriggered
}: {
  projectId: string;
  source: QaRecordSource;
  taggableItems: TaggableItem[];
  defaultVariationItemId: string | null;
  // Same "icon" vs "menu-item" trigger-only distinction as
  // UseAsDayWorksSheetAction — see its comment (Task 4 decluttering).
  variant?: "icon" | "menu-item";
  onTriggered?: () => void;
}) {
  const [step, setStep] = useState<Step>({ name: "closed" });
  const [selectedItemId, setSelectedItemId] = useState(defaultVariationItemId ?? "");
  const [stage, setStage] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  function openPicker() {
    onTriggered?.();
    setSelectedItemId(defaultVariationItemId ?? "");
    setStage("");
    setNotes("");
    setError(null);
    setStep({ name: "picker" });
  }

  async function handleConfirm() {
    if (!stage.trim()) {
      setError("Enter a stage/milestone label first.");
      return;
    }
    setError(null);
    setStep({ name: "working" });

    const response = await fetch(`/api/projects/${projectId}/qa-records`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source,
        stage: stage.trim(),
        notes: notes.trim() || undefined,
        variationItemId: selectedItemId || null
      })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(typeof body?.error === "string" ? body.error : "Could not create a QA record from this file.");
      setStep({ name: "picker" });
      return;
    }

    setStep({ name: "saved" });
  }

  return (
    <>
      {variant === "menu-item" ? (
        <button
          type="button"
          onClick={openPicker}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left text-[#0d141b] dark:text-slate-200 hover:bg-[#f6f7f8] dark:hover:bg-slate-800"
        >
          <span className="material-symbols-outlined text-base">verified</span>
          Use as QA Record
        </button>
      ) : (
        <button
          type="button"
          onClick={openPicker}
          title="Use as QA Record"
          aria-label="Use as QA Record"
          className="text-[#4c739a] dark:text-slate-400 hover:text-primary"
        >
          <span className="material-symbols-outlined text-base align-middle">verified</span>
        </button>
      )}

      {(step.name === "picker" || step.name === "working") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="relative w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 p-5 shadow-lg">
            <h3 className="text-sm font-bold mb-1">Use as QA Record</h3>
            <p className="text-xs text-[#4c739a] dark:text-slate-400 mb-3">
              Creates a new QA record referencing this file. The original stays exactly where it is.
            </p>

            <label className="flex flex-col gap-1 text-xs font-medium mb-3">
              Stage / milestone
              <input
                type="text"
                autoFocus
                value={stage}
                onChange={(event) => setStage(event.target.value)}
                disabled={step.name === "working"}
                placeholder="e.g. Pre-pour reinforcing inspection"
                className="h-9 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium mb-3">
              Notes <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                disabled={step.name === "working"}
                rows={2}
                className="rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium mb-3">
              Assign to
              <select
                value={selectedItemId}
                onChange={(event) => setSelectedItemId(event.target.value)}
                disabled={step.name === "working"}
                className="h-9 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">Project-level (part of the contracted works)</option>
                {taggableItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.reference} · {item.title}
                  </option>
                ))}
              </select>
            </label>

            {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setStep({ name: "closed" })}
                disabled={step.name === "working"}
                className="h-9 px-3 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-medium disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={step.name === "working"}
                className="h-9 px-3 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
              >
                {step.name === "working" ? "Saving..." : "Save QA record"}
              </button>
            </div>
          </div>
        </div>
      )}

      {step.name === "saved" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 p-5 shadow-lg text-sm">
            <p className="mb-3">QA record saved.</p>
            <div className="flex gap-3 justify-end">
              <Link
                href={
                  selectedItemId
                    ? `/projects/${projectId}/variations/${selectedItemId}`
                    : `/projects/${projectId}/quality-assurance`
                }
                className="h-9 px-3 flex items-center rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90"
              >
                View record
              </Link>
              <button
                type="button"
                onClick={() => setStep({ name: "closed" })}
                className="h-9 px-3 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
