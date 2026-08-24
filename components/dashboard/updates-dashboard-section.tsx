"use client";

import { useState } from "react";
import type { UnreadUpdateItem } from "@/lib/updates-feed";
import { DashboardSection } from "@/components/dashboard/dashboard-section";
import { UpdateDashboardRow } from "@/components/dashboard/update-dashboard-row";

// Unlike the 5 deadline-driven sections in dashboard-view.tsx (which simply
// don't render when empty), this section always shows — an explicit "all
// caught up" empty state matters here since Updates is a log/feed, not a
// deadline list, and its absence shouldn't read as "there are no Updates at
// all" versus "you've read them all."
export function UpdatesDashboardSection({ initialItems }: { initialItems: UnreadUpdateItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  function removeItem(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  async function handleMarkAllRead() {
    setItems([]);
    setIsMarkingAll(true);
    await fetch("/api/updates/mark-all-read", { method: "POST" });
    setIsMarkingAll(false);
  }

  return (
    <DashboardSection
      sectionKey="updates"
      label="Project Diary"
      icon="forum"
      itemCount={items.length}
      defaultExpanded={items.length > 0}
      badges={
        items.length > 0 ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
            {items.length} unread
          </span>
        ) : undefined
      }
      headerAction={
        items.length > 0 ? (
          <button
            onClick={handleMarkAllRead}
            disabled={isMarkingAll}
            className="h-8 px-3 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-xs font-bold hover:bg-[#e7edf3] dark:hover:bg-slate-800 disabled:opacity-60 shrink-0"
          >
            {isMarkingAll ? "Marking..." : "Mark all as read"}
          </button>
        ) : undefined
      }
      emptyState={
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#cfdbe7] dark:border-slate-700 py-10">
          <div className="size-12 rounded-full bg-[#e7edf3] dark:bg-slate-800 flex items-center justify-center text-[#4c739a] mb-3">
            <span className="material-symbols-outlined text-2xl">check</span>
          </div>
          <p className="text-[#0d141b] dark:text-slate-50 font-bold text-sm">All caught up</p>
          <p className="text-[#4c739a] dark:text-slate-400 text-xs mt-1">No unread diary entries.</p>
        </div>
      }
    >
      {items.map((item) => (
        <UpdateDashboardRow key={item.id} item={item} onMarkRead={removeItem} />
      ))}
    </DashboardSection>
  );
}
