"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { QARecord, VariationItem } from "@prisma/client";

function toDateInputValue(date: Date) {
  return new Date(date).toISOString().slice(0, 10);
}

export function QaRecordFormDialog({
  projectId,
  taggableItems,
  record,
  defaultVariationItemId,
  open,
  onClose
}: {
  projectId: string;
  taggableItems: VariationItem[];
  record?: QARecord | null;
  // Pre-selects "Link to a Variation/SI" when opened from that item's own
  // page (Task 2.4) — ignored once editing an existing record, which
  // already has its own variationItemId.
  defaultVariationItemId?: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const isEditing = Boolean(record);

  const [stage, setStage] = useState(record?.stage ?? "");
  const [notes, setNotes] = useState(record?.notes ?? "");
  const [date, setDate] = useState(toDateInputValue(record?.date ?? new Date()));
  const [variationItemId, setVariationItemId] = useState(record?.variationItemId ?? defaultVariationItemId ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) return null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    let response: Response;
    if (isEditing) {
      response = await fetch(`/api/projects/${projectId}/qa-records/${record!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage,
          notes: notes || null,
          date: date ? new Date(date).toISOString() : undefined,
          variationItemId: variationItemId || null
        })
      });
    } else {
      const formData = new FormData();
      formData.set("stage", stage);
      if (notes) formData.set("notes", notes);
      if (date) formData.set("date", new Date(date).toISOString());
      if (variationItemId) formData.set("variationItemId", variationItemId);
      files.forEach((file) => formData.append("files", file));

      response = await fetch(`/api/projects/${projectId}/qa-records`, { method: "POST", body: formData });
    }

    setIsSubmitting(false);

    if (!response.ok) {
      const responseBody = await response.json().catch(() => null);
      setError(typeof responseBody?.error === "string" ? responseBody.error : "Could not save this QA record.");
      return;
    }

    onClose();
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
        <h2 className="text-lg font-bold mb-1">{isEditing ? "Edit QA record" : "Add QA record"}</h2>
        <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-5">
          {isEditing
            ? "Update the details for this QA record."
            : "e.g. \"Pre-pour reinforcing inspection,\" \"Final fix QA\" — assign it to the project as a whole, or to a specific Variation/SI."}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Stage / milestone
            <input
              type="text"
              required
              value={stage}
              onChange={(event) => setStage(event.target.value)}
              placeholder="e.g. Pre-pour reinforcing inspection"
              className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Assign to
            <select
              value={variationItemId}
              onChange={(event) => setVariationItemId(event.target.value)}
              className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">Project-level (part of the contracted works)</option>
              {taggableItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.reference} · {item.title}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Date
            <input
              type="date"
              required
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Notes <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span>
            <textarea
              value={notes ?? ""}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              className="rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>

          {!isEditing && (
            <label className="flex flex-col gap-1 text-sm font-medium">
              Files / evidence <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional, multiple allowed)</span>
              <input
                type="file"
                multiple
                onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                className="text-sm file:mr-2 file:h-9 file:px-3 file:rounded-lg file:border-0 file:bg-primary/10 file:text-primary file:font-bold file:text-xs"
              />
              {files.length > 0 && (
                <span className="text-xs text-[#4c739a] dark:text-slate-400">
                  {files.length} file{files.length > 1 ? "s" : ""} selected
                </span>
              )}
            </label>
          )}

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
              {isSubmitting ? "Saving..." : isEditing ? "Save changes" : "Add QA record"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
