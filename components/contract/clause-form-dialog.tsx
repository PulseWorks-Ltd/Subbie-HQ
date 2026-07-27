"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ClauseFormDialog({
  projectId,
  documentId,
  open,
  onClose
}: {
  projectId: string;
  documentId: string;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [clauseRef, setClauseRef] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [riskLevel, setRiskLevel] = useState("low");
  const [status, setStatus] = useState("confirmed");
  const [pageNumber, setPageNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) return null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const response = await fetch(
      `/api/projects/${projectId}/contract-documents/${documentId}/clauses`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clauseRef,
          title: title || undefined,
          body,
          riskLevel,
          status,
          pageNumber: pageNumber ? Number(pageNumber) : undefined
        })
      }
    );

    setIsSubmitting(false);

    if (!response.ok) {
      const responseBody = await response.json().catch(() => null);
      setError(typeof responseBody?.error === "string" ? responseBody.error : "Could not add the clause.");
      return;
    }

    setClauseRef("");
    setTitle("");
    setBody("");
    setRiskLevel("low");
    setStatus("confirmed");
    setPageNumber("");
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
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 p-6 shadow-lg">
        <h2 className="text-lg font-bold mb-1">Add clause</h2>
        <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-5">
          Record a clause from this document for reference and risk tracking.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium flex-1">
              Clause ref
              <input
                type="text"
                required
                value={clauseRef}
                onChange={(event) => setClauseRef(event.target.value)}
                placeholder="14.1"
                className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium w-24">
              Page
              <input
                type="number"
                min={1}
                value={pageNumber}
                onChange={(event) => setPageNumber(event.target.value)}
                className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Title <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Extension of Time"
              className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Clause text
            <textarea
              required
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={4}
              className="rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>

          <div className="flex gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium flex-1">
              Risk level
              <select
                value={riskLevel}
                onChange={(event) => setRiskLevel(event.target.value)}
                className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium flex-1">
              Status
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="draft">Draft</option>
                <option value="parsed">Parsed</option>
                <option value="confirmed">Confirmed</option>
              </select>
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
              {isSubmitting ? "Adding..." : "Add clause"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
