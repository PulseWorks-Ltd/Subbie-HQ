"use client";

// Offline queue for the mobile Project Diary composer's POST
// (components/updates/update-composer.tsx) — same trigger philosophy as
// lib/offline-retry-client.ts (built for Hours on Site: queue on a real
// network error, retry on the browser's 'online' event or the next time
// this module loads), but IndexedDB-backed instead of localStorage, since
// a diary post's FormData can include photo/file attachments (Blobs) that
// aren't JSON-serializable and wouldn't fit localStorage's small quota
// anyway. Kept as its own module rather than folded into
// offline-retry-client.ts, whose entire public API is JSON/localStorage-
// typed — bending it to also accept FormData/Blobs would mean a breaking
// signature change for its 3 existing Hours-on-Site call sites. This is
// the first IndexedDB usage in the app.

const DB_NAME = "subbie-hq-offline-updates";
const DB_VERSION = 1;
const STORE_NAME = "pendingUpdates";

// Generic, not diary-specific — this module never goes stale if the
// composer's own field names change, since it just round-trips whatever
// FormData it's handed.
type StoredField =
  | { key: string; kind: "text"; value: string }
  | { key: string; kind: "file"; name: string; type: string; blob: Blob };

type StoredEntry = { id: string; url: string; queuedAt: string; fields: StoredField[] };

export const OFFLINE_UPDATE_QUEUE_CHANGED_EVENT = "offline-update-queue:changed";

function notifyChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(OFFLINE_UPDATE_QUEUE_CHANGED_EVENT));
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// FormData -> StoredField[]: iterates entries() so repeated keys (the
// composer appends "files" once per attachment) each become their own
// StoredField and round-trip correctly, without this module needing to
// know "files" is special.
function serializeFormData(formData: FormData): StoredField[] {
  const fields: StoredField[] = [];
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      fields.push({ key, kind: "file", name: value.name, type: value.type, blob: value });
    } else {
      fields.push({ key, kind: "text", value });
    }
  }
  return fields;
}

function deserializeFormData(fields: StoredField[]): FormData {
  const formData = new FormData();
  for (const field of fields) {
    if (field.kind === "file") {
      formData.append(field.key, new File([field.blob], field.name, { type: field.type }));
    } else {
      formData.append(field.key, field.value);
    }
  }
  return formData;
}

async function putEntry(entry: StoredEntry): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

async function getAllEntries(): Promise<StoredEntry[]> {
  const db = await openDb();
  try {
    return await new Promise<StoredEntry[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result as StoredEntry[]);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

async function deleteEntry(id: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

// POSTs immediately; on a network failure (not an HTTP error — a real
// inability to reach the server) queues the FormData, attachments
// included, for automatic retry instead of losing it, and returns
// `{ queued: true }` so the caller can show "saved — will post once
// you're back online" instead of a false success or a hard error. This is
// also where the try/catch actually lives — a network error can never
// escape this function uncaught, unlike a bare fetch() in the caller.
export async function postFormWithOfflineRetry(
  url: string,
  formData: FormData
): Promise<{ ok: true; queued: false; response: Response } | { ok: true; queued: true; id: string }> {
  try {
    const response = await fetch(url, { method: "POST", body: formData });
    return { ok: true, queued: false, response };
  } catch {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await putEntry({ id, url, queuedAt: new Date().toISOString(), fields: serializeFormData(formData) });
    notifyChanged();
    return { ok: true, queued: true, id };
  }
}

export async function flushPendingUpdates(): Promise<void> {
  const entries = await getAllEntries();
  if (entries.length === 0) return;

  // Oldest first — preserves the order diary entries were actually
  // written, sent one at a time (not Promise.all) so the server sees them
  // in that same order too.
  entries.sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));

  let changed = false;
  for (const entry of entries) {
    try {
      const response = await fetch(entry.url, { method: "POST", body: deserializeFormData(entry.fields) });
      if (response.ok) {
        await deleteEntry(entry.id);
        changed = true;
      }
      // Non-2xx (e.g. an expired session) — leave it queued for a manual
      // look/retry rather than silently dropping it, same "don't loop
      // forever silently, but don't discard either" stance as
      // lib/offline-retry-client.ts's flushQueue.
    } catch {
      // Still offline — leave this one queued and keep trying the rest,
      // matching flushQueue's own behaviour exactly.
    }
  }
  if (changed) notifyChanged();
}

export async function getPendingUpdateCount(): Promise<number> {
  try {
    return (await getAllEntries()).length;
  } catch {
    return 0;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => void flushPendingUpdates());
  // Mobile browsers don't reliably fire 'online' the instant a
  // backgrounded PWA regains signal the way a foregrounded desktop tab
  // does — additional to, not a replacement for, the 'online' listener
  // above. Diary photos/text are higher-value to flush promptly than the
  // 3 actions lib/offline-retry-client.ts was originally built for, so
  // this extra trigger is worth the few lines here even though the
  // original pattern doesn't have it.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void flushPendingUpdates();
  });
  // Also try once on load, in case connectivity returned while the tab
  // was closed/backgrounded and neither of the above ever fired for it —
  // same reasoning as lib/offline-retry-client.ts's own on-load flush.
  void flushPendingUpdates();
}
