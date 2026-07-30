"use client";

import { useEffect } from "react";

const POLL_INTERVAL_MS = 20_000;
const BASE_TITLE = "Subbie HQ";

// Lightweight alternative to push notifications (see Task 3 of the Updates
// read-tracking feature): no Notification API, no service worker
// subscription, no permission prompt of any kind — just polls the unread
// count and prefixes the tab title while it's non-zero. Only reflects
// activity while the tab is open; does not work when the browser is closed
// (that's what real push notifications are for, deliberately out of scope
// here). There's only one static <title> for the whole app (see
// app/layout.tsx), so unconditionally overwriting it on every poll is safe.
export function UnreadUpdatesIndicator() {
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch("/api/updates/unread-count");
        if (!response.ok || cancelled) return;
        const data: { count: number } = await response.json();
        document.title = data.count > 0 ? `(${data.count}) ${BASE_TITLE}` : BASE_TITLE;
      } catch {
        // Transient network error — the next poll will retry.
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.title = BASE_TITLE;
    };
  }, []);

  return null;
}
