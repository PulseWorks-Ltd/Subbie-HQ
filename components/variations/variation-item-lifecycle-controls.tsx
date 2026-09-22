"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CloseVariationControl } from "@/components/variations/close-variation-control";

type LifecycleEvent = {
  id: string;
  eventType: "closed" | "reactivated" | "completed";
  previousState: string | null;
  newState: string | null;
  note: string | null;
  createdAt: string;
  userName: string;
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-NZ", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Close/Reactivate for a Site Instruction/Variation — remember these are
// the SAME closure dimension regardless of which identity the item
// currently carries (see VariationItem.closedAt's schema comment), so this
// single control works unchanged whether isSiteInstruction, hasVariation,
// or both.
export function VariationItemLifecycleControls({
  projectId,
  itemId,
  closedAt
}: {
  projectId: string;
  itemId: string;
  closedAt: string | null;
}) {
  const router = useRouter();
  const [isReactivating, setIsReactivating] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [history, setHistory] = useState<LifecycleEvent[] | null>(null);

  async function handleReactivate() {
    setIsReactivating(true);
    await fetch(`/api/projects/${projectId}/variation-items/${itemId}/reactivate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    setIsReactivating(false);
    router.refresh();
  }

  async function loadHistory() {
    setIsHistoryOpen((open) => !open);
    if (history) return;
    const response = await fetch(`/api/projects/${projectId}/variation-items/${itemId}/lifecycle-history`);
    const body = await response.json().catch(() => null);
    setHistory(body?.history ?? []);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {closedAt ? (
          <button
            onClick={handleReactivate}
            disabled={isReactivating}
            className="h-9 px-3 rounded-lg border border-primary text-primary text-sm font-bold hover:bg-primary/5 disabled:opacity-60"
          >
            {isReactivating ? "Reactivating..." : "Reactivate"}
          </button>
        ) : (
          <CloseVariationControl projectId={projectId} itemId={itemId} />
        )}
        <button
          onClick={loadHistory}
          className="h-9 px-3 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-xs font-medium text-[#4c739a] dark:text-slate-400 hover:bg-[#e7edf3] dark:hover:bg-slate-800"
        >
          History
        </button>
      </div>

      {isHistoryOpen && history && (
        <div className="rounded-lg border border-[#e7edf3] dark:border-slate-700 p-3 text-xs flex flex-col gap-2 max-w-md">
          {history.length === 0 ? (
            <p className="text-[#4c739a] dark:text-slate-400">No lifecycle events yet.</p>
          ) : (
            history.map((event) => (
              <div key={event.id} className="flex flex-col">
                <span className="font-bold uppercase tracking-wide">
                  {event.eventType} {event.previousState && event.newState && `— ${event.previousState} → ${event.newState}`}
                </span>
                <span className="text-[#4c739a] dark:text-slate-400">
                  {formatDateTime(event.createdAt)} · {event.userName}
                </span>
                {event.note && <span className="mt-0.5">{event.note}</span>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
