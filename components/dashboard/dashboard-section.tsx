"use client";

import { useEffect, useState } from "react";
import type { DashboardItem } from "@/lib/dashboard";
import { DashboardItemRow } from "@/components/dashboard/dashboard-item-row";

const STORAGE_KEY = "subbie-dashboard-collapsed-sections";

function readCollapsedState(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writeCollapsedState(sectionKey: string, isCollapsed: boolean) {
  const stored = readCollapsedState();
  stored[sectionKey] = isCollapsed;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

export function DashboardSection({
  sectionKey,
  label,
  icon,
  items,
  overdueCount,
  upcomingCount,
  defaultExpanded
}: {
  sectionKey: string;
  label: string;
  icon: string;
  items: DashboardItem[];
  overdueCount: number;
  upcomingCount: number;
  defaultExpanded: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  useEffect(() => {
    const stored = readCollapsedState();
    if (sectionKey in stored) {
      setIsExpanded(!stored[sectionKey]);
    }
    // Only read the stored preference once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle() {
    const next = !isExpanded;
    setIsExpanded(next);
    writeCollapsedState(sectionKey, !next);
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={toggle}
        className="flex items-center justify-between gap-3 w-full text-left rounded-lg px-2 py-2 hover:bg-[#e7edf3] dark:hover:bg-slate-800"
      >
        <span className="flex items-center gap-2 text-sm font-bold">
          <span className="material-symbols-outlined text-lg text-[#4c739a] dark:text-slate-400">{icon}</span>
          {label}
        </span>
        <span className="flex items-center gap-2">
          {overdueCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400">
              {overdueCount} overdue
            </span>
          )}
          {upcomingCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              {upcomingCount} upcoming
            </span>
          )}
          <span
            className={`material-symbols-outlined text-lg text-[#4c739a] dark:text-slate-400 transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
          >
            expand_more
          </span>
        </span>
      </button>

      {isExpanded && (
        <div className="flex flex-col gap-2 pl-1">
          {items.map((item) => (
            <DashboardItemRow key={`${item.type}-${item.id}`} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
