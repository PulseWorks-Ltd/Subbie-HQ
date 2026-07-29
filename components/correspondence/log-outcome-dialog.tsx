"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LogOutcomeDialog({
  projectId,
  correspondenceId,
  open,
  onClose
}: {
  projectId: string;
  correspondenceId: string;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!note.trim() && !file) {
      setError("Add a note or upload a revised contract.");
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData();
    if (note.trim()) formData.set("outcomeNote", note.trim());
    if (file) formData.set("file", file);

    const response = await fetch(`/api/projects/${projectId}/correspondence/${correspondenceId}`, {
      method: "PATCH",
      body: formData
    });

    setIsSubmitting(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(typeof body?.error === "string" ? body.error : "Could not log the outcome.");
      return;
    }

    setNote("");
    setFile(null);
    onClose();
    router.refresh();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 p-6 shadow-lg">
        <h2 className="text-lg font-bold mb-1">Log outcome</h2>
        <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-4">
          Record what came of this letter — a note describing what was agreed, and/or the revised contract if one
          resulted. A revised contract becomes this Main Contractor's new baseline for future comparisons.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Note <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span>
            <textarea
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Revised contract <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional, PDF)</span>
            <input
              type="file"
              accept="application/pdf"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="text-sm"
            />
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
              {isSubmitting ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
