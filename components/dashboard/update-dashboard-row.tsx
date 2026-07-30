"use client";

import Link from "next/link";
import type { UnreadUpdateItem } from "@/lib/updates-feed";

function formatTimestamp(date: Date) {
  return new Date(date).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function UpdateDashboardRow({
  item,
  onMarkRead
}: {
  item: UnreadUpdateItem;
  onMarkRead: (id: string) => void;
}) {
  async function handleMarkRead() {
    onMarkRead(item.id);
    await fetch("/api/updates/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updateIds: [item.id] })
    });
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#e7edf3] dark:border-slate-800 p-4 flex items-start gap-3">
      <span className="material-symbols-outlined text-xl mt-0.5 shrink-0 text-[#4c739a] dark:text-slate-400">forum</span>

      <div className="flex-1 min-w-0">
        {/* Visiting the project's Updates page marks every Update on it read
            (see lib/updates-feed.ts's markProjectUpdatesRead), so clicking
            through already covers Task 1.3 — no extra client call needed
            here, just optimistically drop it from this list too. */}
        <Link href={item.href} onClick={() => onMarkRead(item.id)} className="block hover:underline">
          <p className="text-sm leading-snug">
            <span className="font-bold">{item.authorName}</span> — {item.bodyPreview}
          </p>
        </Link>
        <p className="text-xs text-[#4c739a] dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
          <span>
            {item.projectName} · {formatTimestamp(item.createdAt)}
          </span>
          {item.variationItem && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-primary/10 text-primary">
              {item.variationItem.reference}
            </span>
          )}
        </p>
      </div>

      <button
        onClick={handleMarkRead}
        className="h-8 px-3 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-xs font-bold hover:bg-[#e7edf3] dark:hover:bg-slate-800 shrink-0"
      >
        Mark as read
      </button>
    </div>
  );
}
