"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DashboardItem } from "@/lib/dashboard";

const TYPE_ICONS: Record<DashboardItem["type"], string> = {
  programme: "construction",
  variation: "request_quote",
  "site-instruction": "assignment",
  "payment-claim": "payments",
  "safety-document": "health_and_safety",
  retention: "savings"
};

function toDateInputValue(date: Date) {
  return new Date(date).toISOString().slice(0, 10);
}

export function DashboardItemRow({ item }: { item: DashboardItem }) {
  const router = useRouter();
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [newDate, setNewDate] = useState(toDateInputValue(item.date));
  const [isSaving, setIsSaving] = useState(false);

  async function handleComplete() {
    setIsSaving(true);
    if (item.type === "programme") {
      await fetch(`/api/projects/${item.projectId}/programme/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completedAt: new Date().toISOString() })
      });
    } else if (item.type === "variation" || item.type === "site-instruction") {
      await fetch(`/api/projects/${item.projectId}/variation-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "complete" })
      });
    }
    setIsSaving(false);
    router.refresh();
  }

  async function handleReschedule() {
    if (!newDate) return;
    setIsSaving(true);
    const isoDate = new Date(newDate).toISOString();

    if (item.type === "programme") {
      await fetch(`/api/projects/${item.projectId}/programme/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [item.rescheduleField]: isoDate })
      });
    } else if (item.type === "variation" || item.type === "site-instruction") {
      await fetch(`/api/projects/${item.projectId}/variation-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueAt: isoDate })
      });
    } else if (item.type === "payment-claim") {
      await fetch(`/api/projects/${item.projectId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nextClaimDate: isoDate })
      });
    } else if (item.type === "safety-document") {
      await fetch(`/api/projects/${item.projectId}/safety-documents/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiresAt: isoDate })
      });
    } else if (item.type === "retention") {
      await fetch(`/api/projects/${item.projectId}/retention`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [item.rescheduleField]: isoDate })
      });
    }

    setIsSaving(false);
    setIsRescheduling(false);
    router.refresh();
  }

  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-xl border p-4 flex items-start gap-3 ${
        item.isOverdue ? "border-red-200 dark:border-red-900/40" : "border-[#e7edf3] dark:border-slate-800"
      }`}
    >
      <span
        className={`material-symbols-outlined text-xl mt-0.5 shrink-0 ${
          item.isOverdue ? "text-red-500" : "text-[#4c739a] dark:text-slate-400"
        }`}
      >
        {TYPE_ICONS[item.type]}
      </span>

      <div className="flex-1 min-w-0">
        <Link href={item.href} className="block hover:underline">
          <p className="font-bold text-sm leading-tight">{item.headline}</p>
        </Link>
        <p className="text-xs text-[#4c739a] dark:text-slate-400 mt-0.5">
          {item.projectName} ·{" "}
          <span className={item.isOverdue ? "text-red-600 dark:text-red-400 font-bold" : ""}>{item.detail}</span>
        </p>

        {isRescheduling && (
          <div className="flex items-center gap-2 mt-2">
            <input
              type="date"
              value={newDate}
              onChange={(event) => setNewDate(event.target.value)}
              className="h-8 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              onClick={handleReschedule}
              disabled={isSaving}
              className="h-8 px-3 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 disabled:opacity-60"
            >
              Save
            </button>
            <button
              onClick={() => setIsRescheduling(false)}
              className="h-8 px-3 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-xs font-bold"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {!isRescheduling && (
        <div className="flex gap-2 shrink-0">
          {item.canComplete && (
            <button
              onClick={handleComplete}
              disabled={isSaving}
              className="h-8 px-3 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-xs font-bold hover:bg-[#e7edf3] dark:hover:bg-slate-800 disabled:opacity-60"
            >
              Mark complete
            </button>
          )}
          {item.isOverdue && (
            <button
              onClick={() => setIsRescheduling(true)}
              className="h-8 px-3 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-xs font-bold hover:bg-[#e7edf3] dark:hover:bg-slate-800"
            >
              Reschedule
            </button>
          )}
        </div>
      )}
    </div>
  );
}
