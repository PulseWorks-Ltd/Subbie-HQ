"use client";

import { useState } from "react";

// Adds a Variation identity to an existing Site Instruction-origin item —
// same record, not a new one (see VariationItem.variationCreatedAt). Used
// both standalone on the SI's own detail page, and embedded in the
// Variations tab's create dialog when the user links to an existing SI
// instead of creating a fresh standalone Variation.
export function CreateVariationDialog({
  projectId,
  itemId,
  onClose,
  onCreated
}: {
  projectId: string;
  itemId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<"draft" | "open" | "submitted_for_claim" | "complete">("open");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const response = await fetch(`/api/projects/${projectId}/variation-items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        createVariation: true,
        variationValue: value ? Number(value) : undefined,
        status
      })
    });

    setIsSubmitting(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(typeof body?.error === "string" ? body.error : "Could not create the Variation.");
      return;
    }
    onCreated();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 p-6 shadow-lg">
        <h2 className="text-lg font-bold mb-1">Create Variation</h2>
        <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-5">
          This stays the same record — it'll show up in the Variations list, and keep every Day Works Sheet, photo,
          Correspondence entry, and linked Update already attached to it.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Value
            <input
              type="number"
              min={0}
              step="0.01"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="0.00"
              className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as typeof status)}
              className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="draft">Draft</option>
              <option value="open">Open</option>
              <option value="submitted_for_claim">Submitted for Claim</option>
              <option value="complete">Complete</option>
            </select>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 justify-end mt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
            >
              {isSubmitting ? "Creating..." : "Create Variation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
