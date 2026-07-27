"use client";

import type { Clause, ContractDocument, ScopeItem } from "@prisma/client";
import { StatusBadge } from "@/components/badges/status-badge";

type ScopeItemWithSource = ScopeItem & {
  sourceDocument: ContractDocument | null;
  sourceClause: Clause | null;
};

export function ScopeItemCard({
  item,
  onEdit,
  onDelete
}: {
  item: ScopeItemWithSource;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-xl border p-5 ${
        item.ambiguityFlag
          ? "border-amber-400 dark:border-amber-600/50"
          : "border-[#cfdbe7] dark:border-slate-800"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-bold leading-tight">{item.title}</h3>
        <div className="flex gap-2 shrink-0">
          {item.ambiguityFlag && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
              Ambiguous
            </span>
          )}
          <StatusBadge status={item.status} />
        </div>
      </div>

      {item.description && (
        <p className="text-sm text-[#4c739a] dark:text-slate-400 leading-relaxed mb-3">{item.description}</p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#4c739a] dark:text-slate-400 mb-4">
        {item.confidence != null && <span>{Math.round(item.confidence * 100)}% confidence</span>}
        {item.sourceDocument && (
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">description</span>
            {item.sourceDocument.title}
            {item.sourceClause && ` · Clause ${item.sourceClause.clauseRef}`}
            {item.sourcePage && ` · Page ${item.sourcePage}`}
          </span>
        )}
      </div>

      <div className="flex gap-2 pt-3 border-t border-[#e7edf3] dark:border-slate-800">
        <button
          onClick={onEdit}
          className="h-8 px-3 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-xs font-bold hover:bg-[#e7edf3] dark:hover:bg-slate-800"
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          className="h-8 px-3 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
