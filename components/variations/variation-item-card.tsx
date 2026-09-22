"use client";

import Link from "next/link";
import type { VariationItem } from "@prisma/client";
import { StatusBadge } from "@/components/badges/status-badge";
import { CountdownBadge } from "@/components/badges/countdown-badge";
import { CloseVariationControl } from "@/components/variations/close-variation-control";

function formatDate(date: Date | null) {
  if (!date) return null;
  return new Date(date).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

export function VariationItemCard({ projectId, item }: { projectId: string; item: VariationItem }) {
  const isSiteInstruction = item.type === "site_instruction";
  const hasVariation = item.variationCreatedAt != null;
  const href = `/projects/${projectId}/variations/${item.id}`;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#cfdbe7] dark:border-slate-800 p-5 hover:border-primary/50 transition-colors">
      {/* Top row sits OUTSIDE the card's navigation link on purpose — a
          quick "Close" button lives here (Section: Variations list quick-
          close), and it must never double as a navigation click. Only the
          type badges (Site Instruction/Variation) share this row; the
          status badge (Open/Closed) moved to the bottom row below, next to
          the other at-a-glance figures — see close-variation-control.tsx
          for why Close reuses the exact same review-then-confirm flow as
          the item's own detail page, not a shortcut that skips it. */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <Link href={href} className="min-w-0">
          <h3 className="font-bold leading-tight">
            {item.reference} <span className="font-normal text-[#4c739a] dark:text-slate-400">· {item.title}</span>
          </h3>
        </Link>
        <div className="flex items-center gap-2 shrink-0">
          {isSiteInstruction && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
              Site Instruction
            </span>
          )}
          {hasVariation && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-primary/10 text-primary">
              Variation
            </span>
          )}
          {!item.closedAt && (
            <CloseVariationControl
              projectId={projectId}
              itemId={item.id}
              className="h-6 px-2 rounded text-[10px] font-bold uppercase tracking-wide border border-red-300 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
            />
          )}
        </div>
      </div>

      <Link href={href} className="block">
        {item.description && (
          <p className="text-sm text-[#4c739a] dark:text-slate-400 leading-relaxed mb-3 line-clamp-2">
            {item.description}
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#4c739a] dark:text-slate-400">
            {hasVariation && item.variationValue != null && (
              <span className="font-bold text-[#0d141b] dark:text-slate-50">
                ${Number(item.variationValue).toLocaleString("en-NZ", { minimumFractionDigits: 2 })}
              </span>
            )}
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
          <div className="shrink-0">
            {item.closedAt ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                Closed
              </span>
            ) : (
              <StatusBadge status={item.status} />
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
