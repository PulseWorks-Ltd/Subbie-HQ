"use client";

// A deliberately lightweight offline queue — not a full service-worker
// background-sync system, which "desirable" doesn't call for building.
// Covers exactly the 3 actions the feature spec names as needing to
// tolerate poor signal (start, finish, add worker): if the POST fails due
// to a network error, the request is remembered in localStorage and
// retried automatically the moment the browser reports it's back online,
// or the next time this module loads. Nothing here assumes a service
// worker or background sync API exists — plain fetch + localStorage +
// the standard 'online' event, which works in any mobile browser tab that
// re-establishes a connection while still open (or is reopened later).

const STORAGE_KEY = "hoursOnSitePendingActions";

type PendingAction = { id: string; url: string; body: unknown; queuedAt: string };

function readQueue(): PendingAction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PendingAction[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: PendingAction[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // localStorage unavailable (private browsing, quota) — nothing more
    // to do; the action simply won't survive a reload if offline.
  }
}

async function flushQueue() {
  const queue = readQueue();
  if (queue.length === 0) return;

  const remaining: PendingAction[] = [];
  for (const action of queue) {
    try {
      const response = await fetch(action.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action.body)
      });
      if (!response.ok) remaining.push(action); // server rejected it — keep for a manual look, don't loop forever silently
    } catch {
      remaining.push(action); // still offline
    }
  }
  writeQueue(remaining);
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => void flushQueue());
  // Also try once on load, in case connectivity returned while the tab
  // was closed/backgrounded and no 'online' event ever fired for it.
  void flushQueue();
}

// POSTs immediately; on a network failure (not an HTTP error — a real
// inability to reach the server), queues it for automatic retry instead of
// losing it, and returns `{ queued: true }` so the caller can show
// "saved locally — will sync when back online" instead of a false success.
export async function postWithOfflineRetry(
  url: string,
  body: unknown
): Promise<{ ok: true; queued: false; response: Response } | { ok: true; queued: true } | { ok: false; error: string }> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    return { ok: true, queued: false, response };
  } catch {
    const queue = readQueue();
    queue.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, url, body, queuedAt: new Date().toISOString() });
    writeQueue(queue);
    return { ok: true, queued: true };
  }
}

export function getPendingActionCount(): number {
  return readQueue().length;
}
