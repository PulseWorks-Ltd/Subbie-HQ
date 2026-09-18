"use client";

import { useEffect, useState } from "react";
import { getPendingActionCount } from "@/lib/offline-retry-client";
import { getPendingUpdateCount, OFFLINE_UPDATE_QUEUE_CHANGED_EVENT } from "@/lib/offline-update-queue";

// Rendered in the /m header (app/m/layout.tsx) so it's visible from every
// mobile page, not just wherever an offline action happened to be queued —
// otherwise a queued diary post/Hours-on-Site action is invisible again
// the moment the user navigates away from that one screen. Sums both
// queues into a single number: the two underlying queues stay fully
// separate (lib/offline-retry-client.ts for Hours on Site,
// lib/offline-update-queue.ts for the diary composer), only the *display*
// is merged — the user only cares "do I have things that haven't synced
// yet," not which of the two queues they're in. This also finally
// surfaces getPendingActionCount(), which existed already but nothing
// rendered.
export function PendingSyncBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const [actionCount, updateCount] = await Promise.all([
        Promise.resolve(getPendingActionCount()),
        getPendingUpdateCount()
      ]);
      if (!cancelled) setCount(actionCount + updateCount);
    }

    void refresh();

    // No polling — re-checked only when something could plausibly have
    // changed: connectivity returning, or either queue module reporting
    // a write. lib/offline-retry-client.ts doesn't emit its own change
    // event (it predates this component), so "online" is the only signal
    // for that queue; lib/offline-update-queue.ts additionally emits
    // OFFLINE_UPDATE_QUEUE_CHANGED_EVENT on every enqueue/flush, which
    // also fires more promptly than waiting for "online" alone.
    window.addEventListener("online", refresh);
    window.addEventListener(OFFLINE_UPDATE_QUEUE_CHANGED_EVENT, refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("online", refresh);
      window.removeEventListener(OFFLINE_UPDATE_QUEUE_CHANGED_EVENT, refresh);
    };
  }, []);

  if (count === 0) return null;

  return (
    <span
      title={`${count} item${count === 1 ? "" : "s"} waiting to sync`}
      className="flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 rounded-full px-2 py-0.5"
    >
      <span className="material-symbols-outlined text-sm">sync</span>
      {count} pending sync
    </span>
  );
}
