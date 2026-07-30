"use client";

import { useEffect, useState } from "react";

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
  itemCount,
  badges,
  headerAction,
  emptyState,
  defaultExpanded,
  children
}: {
  sectionKey: string;
  label: string;
  icon: string;
  // Rows are passed as pre-rendered children rather than an items array +
  // render callback — this component (and its caller, dashboard-view.tsx)
  // sit on either side of the Server/Client Component boundary, and a
  // function (unlike already-rendered JSX or plain data) can't be passed
  // from a Server Component into a Client Component. Only itemCount is
  // needed here, to decide between the item list and the empty state.
  itemCount: number;
  badges?: React.ReactNode;
  // Rendered as a sibling next to the collapse toggle, not inside it — the
  // toggle is itself a <button>, so anything interactive here must sit
  // outside it rather than nested (invalid, and not clickable independently).
  headerAction?: React.ReactNode;
  // Shown instead of the item list when itemCount is 0 AND expanded — the
  // 5 original sections instead just don't render at all when empty (see
  // dashboard-view.tsx's filter), so this only matters for a section that
  // opts into always being visible (e.g. Updates).
  emptyState?: React.ReactNode;
  defaultExpanded: boolean;
  children?: React.ReactNode;
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
      <div className="flex items-center gap-2">
        <button
          onClick={toggle}
          className="flex-1 flex items-center justify-between gap-3 text-left rounded-lg px-2 py-2 hover:bg-[#e7edf3] dark:hover:bg-slate-800"
        >
          <span className="flex items-center gap-2 text-sm font-bold">
            <span className="material-symbols-outlined text-lg text-[#4c739a] dark:text-slate-400">{icon}</span>
            {label}
          </span>
          <span className="flex items-center gap-2">
            {badges}
            <span
              className={`material-symbols-outlined text-lg text-[#4c739a] dark:text-slate-400 transition-transform ${
                isExpanded ? "rotate-180" : ""
              }`}
            >
              expand_more
            </span>
          </span>
        </button>
        {headerAction}
      </div>

      {isExpanded &&
        (itemCount > 0 ? (
          <div className="flex flex-col gap-2 pl-1">{children}</div>
        ) : (
          emptyState && <div className="pl-1">{emptyState}</div>
        ))}
    </div>
  );
}
