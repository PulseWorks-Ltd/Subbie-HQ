"use client";

import { useState } from "react";
import Link from "next/link";
import type { DelayEvent, VariationItem } from "@prisma/client";
import { DELAY_EVENT_STATUS_LABELS } from "@/lib/delay-events";
import { DelayEventFormDialog } from "@/components/delay-events/delay-event-form-dialog";

type DelayEventRow = DelayEvent & { variationItem: Pick<VariationItem, "id" | "reference" | "title"> | null };

function formatDate(date: Date | string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_COLORS: Record<string, string> = {
  open: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  notice_sent: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300",
  awarded: "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300",
  rejected: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300",
  closed: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500"
};

export function DelayEventsListView({
  projectId,
  delayEvents,
  taggableItems
}: {
  projectId: string;
  delayEvents: DelayEventRow[];
  taggableItems: Pick<VariationItem, "id" | "reference" | "title">[];
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Delay / EOT</h2>
          <p className="text-sm text-[#4c739a] dark:text-slate-400">
            Log a delay as soon as it happens — the notice deadline is tracked automatically from here.
          </p>
        </div>
        <button
          onClick={() => setIsDialogOpen(true)}
          className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 shrink-0"
        >
          Log Delay Event
        </button>
      </div>

      {delayEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#cfdbe7] dark:border-slate-700 py-16">
          <p className="font-bold mb-1">No delay events logged yet</p>
          <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-5">
            A missed written notice can silently forfeit time relief — log it here as soon as it happens.
          </p>
          <button onClick={() => setIsDialogOpen(true)} className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90">
            Log Delay Event
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {delayEvents.map((delayEvent) => (
            <Link
              key={delayEvent.id}
              href={`/projects/${projectId}/delay-events/${delayEvent.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-[#e7edf3] dark:border-slate-700 p-4 hover:border-primary/40"
            >
              <div>
                <p className="font-bold">{delayEvent.cause}</p>
                <p className="text-xs text-[#4c739a] dark:text-slate-400">
                  {formatDate(delayEvent.startDate)}
                  {delayEvent.endDate ? ` – ${formatDate(delayEvent.endDate)}` : " (ongoing)"}
                  {delayEvent.variationItem && ` · ${delayEvent.variationItem.reference}`}
                  {delayEvent.noticeDeadline && ` · Notice due ${formatDate(delayEvent.noticeDeadline)}`}
                </p>
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded shrink-0 ${STATUS_COLORS[delayEvent.status]}`}>
                {DELAY_EVENT_STATUS_LABELS[delayEvent.status]}
              </span>
            </Link>
          ))}
        </div>
      )}

      <DelayEventFormDialog projectId={projectId} taggableItems={taggableItems} open={isDialogOpen} onClose={() => setIsDialogOpen(false)} />
    </div>
  );
}
