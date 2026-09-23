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

export function VariationItemCard({
  projectId,
  item,
  unclaimedValue,
  variationNumber
}: {
  projectId: string;
  item: VariationItem;
  unclaimedValue: number;
  variationNumber: number | undefined;
}) {
  const hasVariation = item.variationCreatedAt != null;
  const href = `/projects/${projectId}/variations/${item.id}`;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#cfdbe7] dark:border-slate-800 p-5 hover:border-primary/50 transition-colors">
      {/* Reference stays top-left, on its own row, so it never collides with
          the Variation badge/Close button on the right, however long the
          reference or those labels get. No separate "Site Instruction"
          label — the reference itself (SI-/NTS-/PO- prefix) already says
          that; the badge here only fires for a Variation identity, and
          names its own sequential number ("Variation 3") rather than just
          repeating the word "Variation". The status badge (Open/Closed)
          lives in the bottom row below, next to the other at-a-glance
          figures — see close-variation-control.tsx for why Close reuses the
          exact same review-then-confirm flow as the item's own detail page,
          not a shortcut that skips it. This row sits OUTSIDE the card's
          navigation link on purpose — Close must never double as a
          navigation click. */}
      <div className="flex items-start justify-between gap-3 mb-1">
        <Link href={href} className="shrink-0">
          <h3 className="font-bold leading-tight">{item.reference}</h3>
        </Link>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {hasVariation && unclaimedValue > 0.005 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              ${unclaimedValue.toLocaleString("en-NZ", { minimumFractionDigits: 2 })} unclaimed
            </span>
          )}
          {hasVariation && variationNumber != null && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-primary/10 text-primary">
              Variation {variationNumber}
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

      {/* Heading text gets its own full-width row beneath the reference —
          it used to sit inline next to the reference and would visually
          clash with the badges/Close cluster on longer titles. */}
      <Link href={href} className="block mb-2">
        <h4 className="font-bold leading-snug text-[#0d141b] dark:text-slate-50">{item.title}</h4>
      </Link>

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
