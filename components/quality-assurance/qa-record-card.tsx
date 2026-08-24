"use client";

import Link from "next/link";
import type { QARecord } from "@prisma/client";

type QaRecordWithItem = QARecord & { variationItem: { id: string; reference: string; title: string } | null };

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

export function QaRecordCard({
  projectId,
  qaRecord,
  showLinkedItem = true,
  onEdit,
  onDelete
}: {
  projectId: string;
  qaRecord: QaRecordWithItem;
  showLinkedItem?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#cfdbe7] dark:border-slate-800 p-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-primary/10 text-primary mb-1">
            {qaRecord.variationItem ? "Item-level" : "Project-level"}
          </span>
          <h3 className="font-bold leading-tight">{qaRecord.stage}</h3>
        </div>
        <span className="text-xs text-[#4c739a] dark:text-slate-400 shrink-0">{formatDate(qaRecord.date)}</span>
      </div>

      {qaRecord.notes && (
        <p className="text-sm text-[#4c739a] dark:text-slate-400 leading-relaxed mb-3">{qaRecord.notes}</p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#4c739a] dark:text-slate-400 mb-4">
        {showLinkedItem && qaRecord.variationItem && (
          <Link
            href={`/projects/${projectId}/variations/${qaRecord.variationItem.id}`}
            className="font-bold text-primary hover:underline"
          >
            {qaRecord.variationItem.reference} · {qaRecord.variationItem.title}
          </Link>
        )}
        {qaRecord.storageKey && (
          <a
            href={`/api/projects/${projectId}/qa-records/${qaRecord.id}/file`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 hover:text-primary"
          >
            <span className="material-symbols-outlined text-sm">description</span>
            {qaRecord.fileName}
          </a>
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
