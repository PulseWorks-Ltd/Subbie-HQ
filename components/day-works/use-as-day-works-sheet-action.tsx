"use client";

import { useState } from "react";
import Link from "next/link";
import {
  DayWorksSheetRecordReviewDialog,
  draftRecordsToRows,
  type SheetRecordRow
} from "@/components/variations/day-works-sheet-record-review-dialog";

export type DayWorksSheetSource = { type: "update-attachment" | "variation-photo"; id: string };
export type TaggableItem = { id: string; reference: string; title: string };

type Step =
  | { name: "closed" }
  | { name: "picker" }
  | { name: "working" }
  | { name: "review"; itemId: string; sheetId: string; rows: SheetRecordRow[]; warning: string | null }
  // Sheet was created but the automatic read failed — mirrors the existing
  // "+Upload" flow's own graceful degradation (see
  // LabourPlantMaterialSection's own extraction flow), which also leaves a bare,
  // record-less sheet behind rather than blocking. The only difference
  // here is telling the user where to go finish it, since — unlike the
  // "+Upload" button — this action isn't already on the item's own page.
  | { name: "degraded"; itemId: string; itemLabel: string }
  | { name: "saved"; itemId: string; itemLabel: string };

// Non-destructive by design (Task 2): this only ever POSTs a *reference* to
// an existing Update attachment or Pictures-tab photo — the source image
// itself is never touched, moved, or deleted. The server copies its bytes
// to a brand-new S3 object per created sheet (see the day-works-sheets
// POST route), so running this action against the same source image more
// than once is always safe and just creates another Day Works Sheet.
export function UseAsDayWorksSheetAction({
  projectId,
  source,
  taggableItems,
  defaultVariationItemId,
  defaultRatePerHour
}: {
  projectId: string;
  source: DayWorksSheetSource;
  taggableItems: TaggableItem[];
  defaultVariationItemId: string | null;
  // Project's configured Normal-hours Day Works rate (ContractTerms is
  // one row per project, not per item — see prisma/schema.prisma), same
  // pre-fill the "+Upload" flow on the item's own page already applies.
  defaultRatePerHour: string;
}) {
  const [step, setStep] = useState<Step>({ name: "closed" });
  const [selectedItemId, setSelectedItemId] = useState(defaultVariationItemId ?? "");
  const [error, setError] = useState<string | null>(null);

  function openPicker() {
    setSelectedItemId(defaultVariationItemId ?? "");
    setError(null);
    setStep({ name: "picker" });
  }

  function itemLabel(itemId: string) {
    const item = taggableItems.find((candidate) => candidate.id === itemId);
    return item ? `${item.reference} — ${item.title}` : "the selected item";
  }

  async function handleConfirm() {
    if (!selectedItemId) {
      setError("Select a Variation/Site Instruction first.");
      return;
    }
    setError(null);
    setStep({ name: "working" });

    const createResponse = await fetch(
      `/api/projects/${projectId}/variation-items/${selectedItemId}/day-works-sheets`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source })
      }
    );
    const createBody = await createResponse.json().catch(() => null);
    const sheetId = createBody?.dayWorksSheet?.id;

    if (!createResponse.ok || !sheetId) {
      setError(typeof createBody?.error === "string" ? createBody.error : "Could not create a Day Works Sheet from this image.");
      setStep({ name: "picker" });
      return;
    }

    const extractResponse = await fetch(
      `/api/projects/${projectId}/variation-items/${selectedItemId}/day-works-sheets/${sheetId}/sheet-records/extract`,
      { method: "POST" }
    );
    const extractBody = await extractResponse.json().catch(() => null);

    if (!extractResponse.ok) {
      setStep({ name: "degraded", itemId: selectedItemId, itemLabel: itemLabel(selectedItemId) });
      return;
    }

    setStep({
      name: "review",
      itemId: selectedItemId,
      sheetId,
      rows: draftRecordsToRows(extractBody.records ?? [], defaultRatePerHour),
      warning: extractBody.warning ?? null
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openPicker}
        title="Use as Day Works Sheet"
        aria-label="Use as Day Works Sheet"
        className="text-[#4c739a] dark:text-slate-400 hover:text-primary"
      >
        <span className="material-symbols-outlined text-base align-middle">construction</span>
      </button>

      {(step.name === "picker" || step.name === "working") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="relative w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 p-5 shadow-lg">
            <h3 className="text-sm font-bold mb-1">Use as Day Works Sheet</h3>
            <p className="text-xs text-[#4c739a] dark:text-slate-400 mb-3">
              Choose which Variation/Site Instruction this Day Works Sheet belongs to. The original photo stays
              where it is.
            </p>

            {taggableItems.length === 0 ? (
              <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">
                No open Variation/Site Instruction items on this project yet.
              </p>
            ) : (
              <select
                value={selectedItemId}
                onChange={(event) => setSelectedItemId(event.target.value)}
                disabled={step.name === "working"}
                className="w-full h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">Select a Variation/SI...</option>
                {taggableItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.reference} · {item.title}
                  </option>
                ))}
              </select>
            )}

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
                disabled={step.name === "working" || taggableItems.length === 0}
                className="h-9 px-3 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
              >
                {step.name === "working" ? "Reading sheet..." : "Continue"}
              </button>
            </div>
          </div>
        </div>
      )}

      {step.name === "review" && (
        <DayWorksSheetRecordReviewDialog
          projectId={projectId}
          itemId={step.itemId}
          sheetId={step.sheetId}
          initialRows={step.rows}
          warning={step.warning}
          defaultRatePerHour={defaultRatePerHour}
          onClose={() => setStep({ name: "closed" })}
          onSaved={() => setStep({ name: "saved", itemId: step.itemId, itemLabel: itemLabel(step.itemId) })}
        />
      )}

      {step.name === "degraded" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 p-5 shadow-lg text-sm">
            <p className="mb-3">
              The Day Works Sheet was created on <strong>{step.itemLabel}</strong>, but it couldn&apos;t be read
              automatically. Open it there to add a summary manually.
            </p>
            <div className="flex gap-3 justify-end">
              <Link
                href={`/projects/${projectId}/variations/${step.itemId}`}
                className="h-9 px-3 flex items-center rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90"
              >
                Open item
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

      {step.name === "saved" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 p-5 shadow-lg text-sm">
            <p className="mb-3">
              Day Works Sheet saved on <strong>{step.itemLabel}</strong>.
            </p>
            <div className="flex gap-3 justify-end">
              <Link
                href={`/projects/${projectId}/variations/${step.itemId}`}
                className="h-9 px-3 flex items-center rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90"
              >
                View sheet
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
