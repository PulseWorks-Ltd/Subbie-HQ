"use client";

import Link from "next/link";
import type { VariationItem } from "@prisma/client";
import { StatusBadge } from "@/components/badges/status-badge";
import { CountdownBadge } from "@/components/badges/countdown-badge";

function formatDate(date: Date | null) {
  if (!date) return null;
  return new Date(date).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

export function VariationItemCard({ projectId, item }: { projectId: string; item: VariationItem }) {
  const isSiteInstruction = item.type === "site_instruction";

  return (
    <Link
      href={`/projects/${projectId}/variations/${item.id}`}
      className="block bg-white dark:bg-slate-900 rounded-xl border border-[#cfdbe7] dark:border-slate-800 p-5 hover:border-primary/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-bold leading-tight">
          {item.reference} <span className="font-normal text-[#4c739a] dark:text-slate-400">· {item.title}</span>
        </h3>
        <div className="flex gap-2 shrink-0">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
              isSiteInstruction
                ? "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                : "bg-primary/10 text-primary"
            }`}
          >
            {isSiteInstruction ? "Site Instruction" : "Variation"}
          </span>
          <StatusBadge status={item.status} />
        </div>
      </div>

      {item.description && (
        <p className="text-sm text-[#4c739a] dark:text-slate-400 leading-relaxed mb-3 line-clamp-2">
          {item.description}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#4c739a] dark:text-slate-400">
        {item.percentComplete != null && <span>{Math.round(item.percentComplete)}% complete</span>}
        {item.suggestedPercentComplete != null && (
          <span className="text-amber-600 dark:text-amber-400 font-medium">
            {Math.round(item.suggestedPercentComplete)}% suggested
          </span>
        )}
        {item.dueAt && (
          <span className="flex items-center gap-1.5">
            Due {formatDate(item.dueAt)}
            {item.status !== "complete" && <CountdownBadge date={item.dueAt} />}
          </span>
        )}
      </div>
    </Link>
  );
}
