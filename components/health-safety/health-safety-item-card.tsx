"use client";

import type { SafetyDocument } from "@prisma/client";
import { CountdownBadge } from "@/components/badges/countdown-badge";

function formatDate(date: Date | null) {
  if (!date) return null;
  return new Date(date).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

export function HealthSafetyItemCard({
  document,
  projectId,
  onEdit,
  onDelete
}: {
  document: SafetyDocument;
  projectId: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#cfdbe7] dark:border-slate-800 p-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-bold leading-tight">{document.title}</h3>
        {document.expiresAt && <CountdownBadge date={document.expiresAt} />}
      </div>

      {document.notes && (
        <p className="text-sm text-[#4c739a] dark:text-slate-400 leading-relaxed mb-3">{document.notes}</p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#4c739a] dark:text-slate-400 mb-4">
        {document.expiresAt && <span>Expires {formatDate(document.expiresAt)}</span>}
        {document.storageKey && (
          <a
            href={`/api/projects/${projectId}/safety-documents/${document.id}/file`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 hover:text-primary"
          >
            <span className="material-symbols-outlined text-sm">description</span>
            {document.fileName}
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
