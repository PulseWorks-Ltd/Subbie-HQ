"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Clause, ContractDocument } from "@prisma/client";
import { StatusBadge } from "@/components/badges/status-badge";
import { RiskBadge } from "@/components/badges/risk-badge";
import { ClauseFormDialog } from "@/components/contract/clause-form-dialog";
import { ContractReviewSection, type ReviewWithChain } from "@/components/contract/contract-review-section";

export function DocumentPanel({
  projectId,
  document
}: {
  projectId: string;
  document: ContractDocument & {
    clauses: Clause[];
    reviews: ReviewWithChain[];
  };
}) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isClauseDialogOpen, setIsClauseDialogOpen] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [clauseSearch, setClauseSearch] = useState("");

  const trimmedSearch = clauseSearch.trim().toLowerCase();
  const matchingClauses =
    trimmedSearch.length === 0
      ? []
      : document.clauses.filter(
          (clause) =>
            clause.clauseRef.toLowerCase().includes(trimmedSearch) ||
            (clause.title?.toLowerCase().includes(trimmedSearch) ?? false) ||
            clause.body.toLowerCase().includes(trimmedSearch)
        );

  async function handleStatusChange(status: string) {
    setIsUpdatingStatus(true);
    await fetch(`/api/projects/${projectId}/contract-documents/${document.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    setIsUpdatingStatus(false);
    router.refresh();
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#cfdbe7] dark:border-slate-800 overflow-hidden">
      <div className="flex items-center justify-between gap-4 p-5">
        <button
          onClick={() => setIsExpanded((value) => !value)}
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
        >
          <span className="material-symbols-outlined text-[#4c739a]">
            {isExpanded ? "expand_less" : "expand_more"}
          </span>
          <div className="min-w-0">
            <p className="font-bold truncate">{document.title}</p>
            <p className="text-xs text-[#4c739a] dark:text-slate-400 truncate">{document.fileName}</p>
          </div>
        </button>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-[#4c739a] dark:text-slate-400">
            {document.clauses.length} clause{document.clauses.length === 1 ? "" : "s"}
          </span>
          <select
            value={document.status}
            disabled={isUpdatingStatus}
            onChange={(event) => handleStatusChange(event.target.value)}
            className="h-8 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="draft">Draft</option>
            <option value="parsed">Parsed</option>
            <option value="confirmed">Confirmed</option>
          </select>
          <a
            href={`/api/projects/${projectId}/contract-documents/${document.id}/file`}
            target="_blank"
            rel="noreferrer"
            className="h-8 px-3 flex items-center rounded-lg border border-[#e7edf3] dark:border-slate-700 text-xs font-bold hover:bg-[#e7edf3] dark:hover:bg-slate-800"
          >
            View file
          </a>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-[#e7edf3] dark:border-slate-800 p-5 pt-4">
          <div className="flex items-center justify-between mb-3 gap-3">
            <h4 className="text-sm font-bold">Clauses</h4>
            <button
              onClick={() => setIsClauseDialogOpen(true)}
              className="h-8 px-3 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 shrink-0"
            >
              + Add clause
            </button>
          </div>

          {document.clauses.length === 0 ? (
            <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-5">No clauses recorded yet.</p>
          ) : (
            <div className="mb-5">
              <div className="relative mb-3">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-lg text-[#4c739a] dark:text-slate-400">
                  search
                </span>
                <input
                  type="text"
                  value={clauseSearch}
                  onChange={(event) => setClauseSearch(event.target.value)}
                  placeholder={`Search ${document.clauses.length} clause${document.clauses.length === 1 ? "" : "s"} on file — e.g. "retention", "notice", "defects"`}
                  className="h-10 w-full rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              {trimmedSearch.length === 0 ? (
                <p className="text-sm text-[#4c739a] dark:text-slate-400">
                  Every clause from this document is extracted and kept in the background for Contract Review,
                  Settings, and Insurance — search above to find a specific one, or{" "}
                  <a
                    href={`/api/projects/${projectId}/contract-documents/${document.id}/file`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    view the original file
                  </a>
                  .
                </p>
              ) : matchingClauses.length === 0 ? (
                <p className="text-sm text-[#4c739a] dark:text-slate-400">No clauses match "{clauseSearch}".</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {matchingClauses.map((clause) => (
                    <div key={clause.id} className="rounded-lg border border-[#e7edf3] dark:border-slate-800 p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <p className="text-sm font-bold">
                            Clause {clause.clauseRef}
                            {clause.title && <span className="font-normal text-[#4c739a] dark:text-slate-400"> · {clause.title}</span>}
                          </p>
                          {clause.pageNumber && (
                            <p className="text-[11px] text-[#4c739a] dark:text-slate-400">Page {clause.pageNumber}</p>
                          )}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <RiskBadge level={clause.riskLevel} />
                          <StatusBadge status={clause.status} />
                        </div>
                      </div>
                      <p className="text-sm text-[#4c739a] dark:text-slate-400 leading-relaxed">{clause.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <ContractReviewSection
            projectId={projectId}
            documentId={document.id}
            initialReview={document.reviews[0] ?? null}
            hasClauses={document.clauses.length > 0}
            processingStatus={document.processingStatus}
            processingError={document.processingError}
          />
        </div>
      )}

      <ClauseFormDialog
        projectId={projectId}
        documentId={document.id}
        open={isClauseDialogOpen}
        onClose={() => {
          setIsClauseDialogOpen(false);
          setIsExpanded(true);
        }}
      />
    </div>
  );
}
