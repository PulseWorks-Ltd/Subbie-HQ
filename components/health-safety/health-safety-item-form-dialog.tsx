"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SafetyDocument } from "@prisma/client";

function toDateInputValue(date: Date | null) {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

export function HealthSafetyItemFormDialog({
  projectId,
  document,
  open,
  onClose
}: {
  projectId: string;
  document?: SafetyDocument | null;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const isEditing = Boolean(document);

  const [title, setTitle] = useState(document?.title ?? "");
  const [notes, setNotes] = useState(document?.notes ?? "");
  const [expiresAt, setExpiresAt] = useState(toDateInputValue(document?.expiresAt ?? null));
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) return null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    let response: Response;
    if (isEditing) {
      response = await fetch(`/api/projects/${projectId}/safety-documents/${document!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          notes: notes || null,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null
        })
      });
    } else {
      const formData = new FormData();
      formData.set("title", title);
      if (notes) formData.set("notes", notes);
      if (expiresAt) formData.set("expiresAt", new Date(expiresAt).toISOString());
      if (file) formData.set("file", file);

      response = await fetch(`/api/projects/${projectId}/safety-documents`, {
        method: "POST",
        body: formData
      });
    }

    setIsSubmitting(false);

    if (!response.ok) {
      const responseBody = await response.json().catch(() => null);
      setError(typeof responseBody?.error === "string" ? responseBody.error : "Could not save this document.");
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
        <h2 className="text-lg font-bold mb-1">{isEditing ? "Edit safety document" : "Add safety document"}</h2>
        <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-5">
          {isEditing
            ? "Update the details for this document."
            : "e.g. SSSP, Hazard Register, H&S Policy — with an expiry date if it needs renewing."}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Title
            <input
              type="text"
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. SSSP"
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

          <label className="flex flex-col gap-1 text-sm font-medium">
            Expiry date <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span>
            <input
              type="date"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
              className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>

          {!isEditing && (
            <label className="flex flex-col gap-1 text-sm font-medium">
              File <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span>
              <input
                type="file"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="text-sm file:mr-2 file:h-9 file:px-3 file:rounded-lg file:border-0 file:bg-primary/10 file:text-primary file:font-bold file:text-xs"
              />
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
              {isSubmitting ? "Saving..." : isEditing ? "Save changes" : "Add document"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
