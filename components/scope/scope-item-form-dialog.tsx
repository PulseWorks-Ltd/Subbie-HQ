"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Clause, ContractDocument, ScopeItem } from "@prisma/client";

type DocumentWithClauses = ContractDocument & { clauses: Clause[] };

export function ScopeItemFormDialog({
  projectId,
  documents,
  item,
  open,
  onClose
}: {
  projectId: string;
  documents: DocumentWithClauses[];
  item?: ScopeItem | null;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const isEditing = Boolean(item);

  const [title, setTitle] = useState(item?.title ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [status, setStatus] = useState<string>(item?.status ?? "confirmed");
  const [confidencePercent, setConfidencePercent] = useState(
    item?.confidence != null ? Math.round(item.confidence * 100) : 100
  );
  const [ambiguityFlag, setAmbiguityFlag] = useState(item?.ambiguityFlag ?? false);
  const [sourceDocumentId, setSourceDocumentId] = useState("");
  const [sourceClauseId, setSourceClauseId] = useState("");
  const [sourcePage, setSourcePage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) return null;

  const selectedDocument = documents.find((document) => document.id === sourceDocumentId);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const url = isEditing
      ? `/api/projects/${projectId}/scope/${item!.id}`
      : `/api/projects/${projectId}/scope`;

    const body = isEditing
      ? {
          title,
          description: description || null,
          status,
          confidence: confidencePercent / 100,
          ambiguityFlag
        }
      : {
          title,
          description: description || undefined,
          status,
          confidence: confidencePercent / 100,
          ambiguityFlag,
          sourceDocumentId: sourceDocumentId || undefined,
          sourceClauseId: sourceClauseId || undefined,
          sourcePage: sourcePage ? Number(sourcePage) : undefined
        };

    const response = await fetch(url, {
      method: isEditing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const responseBody = await response.json().catch(() => null);
      setError(typeof responseBody?.error === "string" ? responseBody.error : "Could not save the scope item.");
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
        <h2 className="text-lg font-bold mb-1">{isEditing ? "Edit scope item" : "Add scope item"}</h2>
        <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-5">
          {isEditing
            ? "Update the details for this scope item."
            : "Record a piece of scope, optionally linked back to a contract clause."}
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
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              className="rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>

          <div className="flex gap-3">
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

            <label className="flex flex-col gap-1 text-sm font-medium flex-1">
              Confidence: {confidencePercent}%
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={confidencePercent}
                onChange={(event) => setConfidencePercent(Number(event.target.value))}
                className="h-10"
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={ambiguityFlag}
              onChange={(event) => setAmbiguityFlag(event.target.checked)}
              className="size-4 rounded border-[#e7edf3] dark:border-slate-700"
            />
            Flag as ambiguous / needs clarification
          </label>

          {!isEditing && (
            <>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Source document <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span>
                <select
                  value={sourceDocumentId}
                  onChange={(event) => {
                    setSourceDocumentId(event.target.value);
                    setSourceClauseId("");
                  }}
                  className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">None</option>
                  {documents.map((document) => (
                    <option key={document.id} value={document.id}>
                      {document.title}
                    </option>
                  ))}
                </select>
              </label>

              {selectedDocument && selectedDocument.clauses.length > 0 && (
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Source clause <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span>
                  <select
                    value={sourceClauseId}
                    onChange={(event) => setSourceClauseId(event.target.value)}
                    className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="">None</option>
                    {selectedDocument.clauses.map((clause) => (
                      <option key={clause.id} value={clause.id}>
                        Clause {clause.clauseRef}
                        {clause.title ? ` · ${clause.title}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="flex flex-col gap-1 text-sm font-medium w-32">
                Source page <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span>
                <input
                  type="number"
                  min={1}
                  value={sourcePage}
                  onChange={(event) => setSourcePage(event.target.value)}
                  className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </label>
            </>
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
              {isSubmitting ? "Saving..." : isEditing ? "Save changes" : "Add scope item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
