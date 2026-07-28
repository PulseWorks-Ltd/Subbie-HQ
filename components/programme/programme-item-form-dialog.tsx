"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProgrammeItem } from "@prisma/client";

function toDateInputValue(date: Date | null) {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

export function ProgrammeItemFormDialog({
  projectId,
  item,
  open,
  onClose
}: {
  projectId: string;
  item?: ProgrammeItem | null;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const isEditing = Boolean(item);

  const [title, setTitle] = useState(item?.title ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [startDate, setStartDate] = useState(toDateInputValue(item?.startDate ?? null));
  const [endDate, setEndDate] = useState(toDateInputValue(item?.endDate ?? null));
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) return null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const url = isEditing
      ? `/api/projects/${projectId}/programme/${item!.id}`
      : `/api/projects/${projectId}/programme`;

    const body = {
      title,
      description: description || (isEditing ? null : undefined),
      startDate: startDate ? new Date(startDate).toISOString() : undefined,
      endDate: endDate ? new Date(endDate).toISOString() : undefined,
      status: isEditing ? undefined : "confirmed"
    };

    const response = await fetch(url, {
      method: isEditing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const responseBody = await response.json().catch(() => null);
      setError(typeof responseBody?.error === "string" ? responseBody.error : "Could not save the milestone.");
      return;
    }

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
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 p-6 shadow-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold mb-1">{isEditing ? "Edit milestone" : "Add milestone"}</h2>
        <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-5">
          {isEditing ? "Update the details for this programme item." : "Add an activity or milestone to the programme."}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Title
            <input
              type="text"
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Description <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span>
            <textarea
              value={description ?? ""}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              className="rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>

          <div className="flex gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium flex-1">
              Start date <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium flex-1">
              End date <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span>
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>
          </div>

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
              {isSubmitting ? "Saving..." : isEditing ? "Save changes" : "Add milestone"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
