"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { VariationItem } from "@prisma/client";
import { CorrespondenceFormDialog } from "@/components/correspondence/correspondence-form-dialog";
import { LogOutcomeDialog } from "@/components/correspondence/log-outcome-dialog";

export type CorrespondenceRow = {
  id: string;
  kind: "email" | "upload" | "letter_draft";
  title: string;
  subtitle: string | null;
  body: string | null;
  category: string | null;
  fileHref: string | null;
  linkedItem: { id: string; reference: string; title: string } | null;
  date: Date;
  deletable: boolean;
  outcomeNote: string | null;
  hasOutcome: boolean;
};

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

export function CorrespondenceView({
  projectId,
  rows,
  taggableItems,
  initialQuery
}: {
  projectId: string;
  rows: CorrespondenceRow[];
  taggableItems: VariationItem[];
  initialQuery: string;
}) {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [outcomeRowId, setOutcomeRowId] = useState<string | null>(null);
  const [query, setQuery] = useState(initialQuery);

  async function handleDelete(row: CorrespondenceRow) {
    if (!confirm(`Delete "${row.title}"?`)) return;
    await fetch(`/api/projects/${projectId}/correspondence/${row.id}`, { method: "DELETE" });
    router.refresh();
  }

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    router.push(`/projects/${projectId}/correspondence${trimmed ? `?q=${encodeURIComponent(trimmed)}` : ""}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Correspondence</h2>
          <p className="text-sm text-[#4c739a] dark:text-slate-400">
            Emails and documents representing communication on this project.
          </p>
        </div>
        <button
          onClick={() => setIsDialogOpen(true)}
          className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 shrink-0"
        >
          Add Correspondence
        </button>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by keyword, type, or Variation/SI reference..."
          className="flex-1 h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          type="submit"
          className="h-10 px-4 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-bold hover:bg-[#e7edf3] dark:hover:bg-slate-800"
        >
          Search
        </button>
        {initialQuery && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              router.push(`/projects/${projectId}/correspondence`);
            }}
            className="h-10 px-4 rounded-lg text-sm font-medium text-[#4c739a] dark:text-slate-400 hover:underline"
          >
            Clear
          </button>
        )}
      </form>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#cfdbe7] dark:border-slate-700 py-16">
          <p className="font-bold mb-1">{initialQuery ? "No matches" : "No correspondence yet"}</p>
          <p className="text-sm text-[#4c739a] dark:text-slate-400">
            {initialQuery
              ? "Try a different keyword, type, or Variation/SI reference."
              : "Inbound emails and manually added documents will show up here."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row) => (
            <div
              key={row.id}
              className="bg-white dark:bg-slate-900 rounded-xl border border-[#e7edf3] dark:border-slate-800 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="material-symbols-outlined text-lg text-[#4c739a] dark:text-slate-400 mt-0.5 shrink-0">
                    {row.kind === "email" ? "mail" : row.kind === "letter_draft" ? "draft" : "description"}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{row.title}</p>
                    <p className="text-xs text-[#4c739a] dark:text-slate-400">
                      {row.category && `${row.category} · `}
                      {row.subtitle && `${row.subtitle} · `}
                      {formatDate(row.date)}
                      {row.hasOutcome && " · Outcome logged"}
                      {row.linkedItem && (
                        <>
                          {" · "}
                          <Link
                            href={`/projects/${projectId}/variations/${row.linkedItem.id}`}
                            className="text-primary hover:underline"
                          >
                            {row.linkedItem.reference}
                          </Link>
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {(row.kind === "email" || row.kind === "letter_draft") && (
                    <button
                      onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      {expandedId === row.id ? "Hide" : "View"}
                    </button>
                  )}
                  {row.kind === "letter_draft" && (
                    <button
                      onClick={() => setOutcomeRowId(row.id)}
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      Log outcome
                    </button>
                  )}
                  {row.fileHref && (
                    <a
                      href={row.fileHref}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      Download
                    </a>
                  )}
                  {row.deletable && (
                    <button
                      onClick={() => handleDelete(row)}
                      className="text-xs font-bold text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {(row.kind === "email" || row.kind === "letter_draft") && expandedId === row.id && row.body && (
                <p className="mt-3 pt-3 border-t border-[#e7edf3] dark:border-slate-800 text-sm text-[#0d141b] dark:text-slate-200 whitespace-pre-wrap">
                  {row.body}
                </p>
              )}

              {row.outcomeNote && (
                <p className="mt-3 pt-3 border-t border-[#e7edf3] dark:border-slate-800 text-xs text-[#4c739a] dark:text-slate-400">
                  <span className="font-bold">Outcome: </span>
                  {row.outcomeNote}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <CorrespondenceFormDialog
        projectId={projectId}
        taggableItems={taggableItems}
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
      />

      {outcomeRowId && (
        <LogOutcomeDialog
          projectId={projectId}
          correspondenceId={outcomeRowId}
          open={Boolean(outcomeRowId)}
          onClose={() => setOutcomeRowId(null)}
        />
      )}
    </div>
  );
}
