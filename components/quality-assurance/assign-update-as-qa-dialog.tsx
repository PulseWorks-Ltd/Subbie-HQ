"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TaggableItem } from "@/components/quality-assurance/use-as-qa-record-action";

// Triggered from the Update tag dropdown's "Assign QA" option
// (components/updates/update-thread.tsx) — converts the WHOLE update
// (every attachment, plus its body as a starting point for notes) into one
// QARecord in a single step, matching how a user actually works: take
// several photos, dictate a note in the update, then convert that into QA
// evidence. Non-destructive — the Update and its attachments are untouched;
// the server copies each attachment's bytes into its own QARecordAttachment
// (see the qa-records POST route's source: { type: "update" } branch).
export function AssignUpdateAsQaDialog({
  projectId,
  updateId,
  updateBody,
  taggableItems,
  defaultVariationItemId,
  onClose,
  onAssigned
}: {
  projectId: string;
  updateId: string;
  updateBody: string;
  taggableItems: TaggableItem[];
  defaultVariationItemId: string | null;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const router = useRouter();
  const [stage, setStage] = useState("");
  const [notes, setNotes] = useState(updateBody);
  const [variationItemId, setVariationItemId] = useState(defaultVariationItemId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleConfirm() {
    if (!stage.trim()) {
      setError("Enter a stage/milestone label first.");
      return;
    }
    setError(null);
    setIsSubmitting(true);

    const response = await fetch(`/api/projects/${projectId}/qa-records`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: { type: "update", id: updateId },
        stage: stage.trim(),
        notes: notes.trim() || undefined,
        variationItemId: variationItemId || null
      })
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(typeof body?.error === "string" ? body.error : "Could not create a QA record from this update.");
      return;
    }

    router.refresh();
    onAssigned();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="relative w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 p-5 shadow-lg">
        <h3 className="text-sm font-bold mb-1">Assign QA</h3>
        <p className="text-xs text-[#4c739a] dark:text-slate-400 mb-3">
          Creates one QA record covering every photo on this update, with its text as a starting point for notes. The
          update itself stays exactly as posted.
        </p>

        <label className="flex flex-col gap-1 text-xs font-medium mb-3">
          Stage / milestone
          <input
            type="text"
            autoFocus
            value={stage}
            onChange={(event) => setStage(event.target.value)}
            disabled={isSubmitting}
            placeholder="e.g. Lining proof — Stage 1B slab, prior to pour"
            className="h-9 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium mb-3">
          Notes
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            disabled={isSubmitting}
            rows={3}
            className="rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium mb-3">
          Assign to
          <select
            value={variationItemId}
            onChange={(event) => setVariationItemId(event.target.value)}
            disabled={isSubmitting}
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
            onClick={onClose}
            disabled={isSubmitting}
            className="h-9 px-3 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-medium disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="h-9 px-3 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
          >
            {isSubmitting ? "Saving..." : "Assign QA"}
          </button>
        </div>
      </div>
    </div>
  );
}
