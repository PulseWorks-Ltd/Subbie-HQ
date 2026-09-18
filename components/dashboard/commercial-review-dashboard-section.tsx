"use client";

import { useState } from "react";
import type { CommercialReviewFeedItem } from "@/lib/commercial-review";
import { DashboardSection } from "@/components/dashboard/dashboard-section";
import { CommercialReviewItemRow } from "@/components/dashboard/commercial-review-item-row";

// Every untagged (or Contract-tagged-but-no-%) top-level diary entry shows
// up here, going forward — not just ones an AI thinks look "commercially
// interesting" (see lib/commercial-review.ts's own header comment for the
// full reasoning). Because of that, volume can be real on a busy project;
// capped to the top N by priority inline rather than building a whole
// separate paginated page for v1 — a project with a genuine backlog is
// better served by tagging as they go (or bulk "No Action Required"/
// "General") than by an ever-scrolling dashboard section.
const VISIBLE_CAP = 8;

export function CommercialReviewDashboardSection({ initialItems }: { initialItems: CommercialReviewFeedItem[] }) {
  const [items, setItems] = useState(initialItems);

  function removeItem(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  const visible = items.slice(0, VISIBLE_CAP);
  const remaining = items.length - visible.length;

  return (
    <DashboardSection
      sectionKey="commercial-review"
      label="Commercial Review"
      icon="assignment_late"
      itemCount={items.length}
      defaultExpanded={items.length > 0}
      badges={
        items.length > 0 ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            {items.length} pending
          </span>
        ) : undefined
      }
      emptyState={
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#cfdbe7] dark:border-slate-700 py-10">
          <div className="size-12 rounded-full bg-[#e7edf3] dark:bg-slate-800 flex items-center justify-center text-[#4c739a] mb-3">
            <span className="material-symbols-outlined text-2xl">check</span>
          </div>
          <p className="text-[#0d141b] dark:text-slate-50 font-bold text-sm">All caught up</p>
          <p className="text-[#4c739a] dark:text-slate-400 text-xs mt-1">
            Every diary entry has a commercial destination, or no action required.
          </p>
        </div>
      }
    >
      {visible.map((item) => (
        <CommercialReviewItemRow key={item.id} item={item} onResolved={removeItem} />
      ))}
      {remaining > 0 && (
        <p className="text-xs text-[#4c739a] dark:text-slate-400 text-center py-2">
          +{remaining} more pending — open a project's Project Diary to review the rest.
        </p>
      )}
    </DashboardSection>
  );
}
