"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SiteInstruction } from "@prisma/client";

export function SiteInstructionsPanel({
  projectId,
  siteInstructions
}: {
  projectId: string;
  siteInstructions: SiteInstruction[];
}) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [reference, setReference] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const response = await fetch(`/api/projects/${projectId}/site-instructions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference, title, description: description || undefined })
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(typeof body?.error === "string" ? body.error : "Could not create the site instruction.");
      return;
    }

    setReference("");
    setTitle("");
    setDescription("");
    setIsCreating(false);
    router.refresh();
  }

  async function toggleStatus(siteInstruction: SiteInstruction) {
    setUpdatingId(siteInstruction.id);
    const nextStatus = siteInstruction.status === "open" ? "complete" : "open";
    await fetch(`/api/projects/${projectId}/site-instructions/${siteInstruction.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus })
    });
    setUpdatingId(null);
    router.refresh();
  }

  return (
    <div className="w-72 shrink-0 bg-white dark:bg-slate-900 rounded-xl border border-[#cfdbe7] dark:border-slate-800 flex flex-col">
      <div className="p-4 border-b border-[#e7edf3] dark:border-slate-800 flex items-center justify-between">
        <h3 className="text-sm font-bold">Site Instructions</h3>
        <button
          onClick={() => setIsCreating((value) => !value)}
          className="text-xs font-bold text-primary hover:underline"
        >
          {isCreating ? "Cancel" : "+ Add"}
        </button>
      </div>

      {isCreating && (
        <form onSubmit={handleCreate} className="p-4 border-b border-[#e7edf3] dark:border-slate-800 flex flex-col gap-2">
          <input
            type="text"
            required
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="Reference (e.g. SI-004)"
            className="h-9 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <input
            type="text"
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Title"
            className="h-9 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            placeholder="Description (optional)"
            className="rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-9 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 disabled:opacity-60"
          >
            {isSubmitting ? "Adding..." : "Add"}
          </button>
        </form>
      )}

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {siteInstructions.length === 0 ? (
          <p className="text-xs text-[#4c739a] dark:text-slate-400 px-1 py-2">
            No SIs or NTSs logged for this project yet.
          </p>
        ) : (
          siteInstructions.map((siteInstruction) => (
            <div key={siteInstruction.id} className="rounded-lg border border-[#e7edf3] dark:border-slate-800 p-3">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-xs font-bold">
                  {siteInstruction.reference}
                  <span className="font-normal text-[#4c739a] dark:text-slate-400"> · {siteInstruction.title}</span>
                </p>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                    siteInstruction.status === "complete"
                      ? "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                  }`}
                >
                  {siteInstruction.status === "complete" ? "Complete" : "Open"}
                </span>
                <button
                  onClick={() => toggleStatus(siteInstruction)}
                  disabled={updatingId === siteInstruction.id}
                  className="text-[11px] font-bold text-primary hover:underline disabled:opacity-60"
                >
                  Mark {siteInstruction.status === "complete" ? "open" : "complete"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
