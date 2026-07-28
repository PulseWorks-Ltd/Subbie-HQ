"use client";

import type { ContractDocument, ProgrammeItem } from "@prisma/client";
import { StatusBadge } from "@/components/badges/status-badge";
import { CountdownBadge } from "@/components/badges/countdown-badge";

type ProgrammeItemWithSource = ProgrammeItem & { sourceDocument: ContractDocument | null };

function formatDate(date: Date | null) {
  if (!date) return null;
  return new Date(date).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

export function ProgrammeItemCard({
  item,
  projectId,
  onEdit,
  onDelete,
  onToggleComplete
}: {
  item: ProgrammeItemWithSource;
  projectId: string;
  onEdit: () => void;
  onDelete: () => void;
  onToggleComplete: () => void;
}) {
  const isComplete = Boolean(item.completedAt);
  const startLabel = formatDate(item.startDate);
  const endLabel = formatDate(item.endDate);

  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-xl border p-5 ${
        isComplete ? "border-[#cfdbe7] dark:border-slate-800 opacity-70" : "border-[#cfdbe7] dark:border-slate-800"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className={`font-bold leading-tight ${isComplete ? "line-through text-[#4c739a] dark:text-slate-500" : ""}`}>
          {item.title}
        </h3>
        <div className="flex gap-2 shrink-0">
          <StatusBadge status={item.status} />
        </div>
      </div>

      {item.description && (
        <p className="text-sm text-[#4c739a] dark:text-slate-400 leading-relaxed mb-3">{item.description}</p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#4c739a] dark:text-slate-400 mb-3">
        {startLabel && endLabel && <span>{startLabel} → {endLabel}</span>}
        {startLabel && !endLabel && <span>Starts {startLabel}</span>}
        {!startLabel && endLabel && <span>Due {endLabel}</span>}
        {!startLabel && !endLabel && <span>No dates set</span>}
        {item.sourceDocument && item.confidence != null && (
          <span>{Math.round(item.confidence * 100)}% confidence</span>
        )}
        {item.sourceDocument && (
          <a
            href={`/api/projects/${projectId}/contract-documents/${item.sourceDocument.id}/file`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 hover:text-primary"
          >
            <span className="material-symbols-outlined text-sm">description</span>
            Parsed from {item.sourceDocument.fileName}
          </a>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 pt-3 border-t border-[#e7edf3] dark:border-slate-800">
        <div>
          {isComplete ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400">
              Completed {formatDate(item.completedAt)}
            </span>
          ) : (
            item.endDate && <CountdownBadge date={item.endDate} />
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onToggleComplete}
            className="h-8 px-3 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-xs font-bold hover:bg-[#e7edf3] dark:hover:bg-slate-800"
          >
            {isComplete ? "Reopen" : "Mark complete"}
          </button>
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
    </div>
  );
}
