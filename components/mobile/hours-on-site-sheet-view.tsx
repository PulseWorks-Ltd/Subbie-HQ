"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { postWithOfflineRetry } from "@/lib/offline-retry-client";

type ContactOption = { id: string; name: string; email: string | null; role: string | null };
type WorkerOption = { id: string; name: string };
type VariationItemRef = { id: string; reference: string; title: string };

const ONE_OFF_SENTINEL = "__one_off__";

function toDateTimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function HoursOnSiteSheetView({
  projectId,
  contacts,
  sheet
}: {
  projectId: string;
  contacts: ContactOption[];
  sheet: {
    id: string;
    projectName: string;
    variationItem: VariationItemRef | null;
    comments: string | null;
    startedAt: string;
    finishedAt: string | null;
    totalHours: number | null;
    workers: WorkerOption[];
  };
}) {
  const router = useRouter();
  const [startedAt, setStartedAt] = useState(toDateTimeLocal(sheet.startedAt));
  const [finishedAt, setFinishedAt] = useState(toDateTimeLocal(sheet.finishedAt));
  const [totalHours, setTotalHours] = useState(sheet.totalHours != null ? String(sheet.totalHours) : "");
  const [isSavingTimes, setIsSavingTimes] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  const [workerQuery, setWorkerQuery] = useState("");
  const [workerResults, setWorkerResults] = useState<WorkerOption[]>([]);
  const [isAddingWorker, setIsAddingWorker] = useState(false);
  const [offlineNotice, setOfflineNotice] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const eligibleContacts = contacts.filter((contact) => contact.email);
  const [recipientSelection, setRecipientSelection] = useState(eligibleContacts[0]?.id ?? ONE_OFF_SENTINEL);
  const [oneOffEmail, setOneOffEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!workerQuery.trim()) {
      setWorkerResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const response = await fetch(`/api/projects/${projectId}/workers?q=${encodeURIComponent(workerQuery)}`);
      const body = await response.json().catch(() => null);
      setWorkerResults(body?.workers ?? []);
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [workerQuery, projectId]);

  async function saveTimes() {
    setIsSavingTimes(true);
    await fetch(`/api/projects/${projectId}/hours-on-site/${sheet.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startedAt: startedAt ? new Date(startedAt).toISOString() : undefined,
        finishedAt: finishedAt ? new Date(finishedAt).toISOString() : null,
        totalHours: totalHours ? Number(totalHours) : null
      })
    });
    setIsSavingTimes(false);
    router.refresh();
  }

  async function handleFinishNow() {
    setIsFinishing(true);
    await fetch(`/api/projects/${projectId}/hours-on-site/${sheet.id}/finish`, { method: "POST" });
    setIsFinishing(false);
    router.refresh();
  }

  async function addWorker(workerId?: string, name?: string) {
    setIsAddingWorker(true);
    setOfflineNotice(null);
    const result = await postWithOfflineRetry(`/api/projects/${projectId}/hours-on-site/${sheet.id}/workers`, {
      workerId,
      name
    });
    setIsAddingWorker(false);
    setWorkerQuery("");
    setWorkerResults([]);
    if (result.ok && result.queued) {
      setOfflineNotice("You're offline — adding this worker has been saved and will sync automatically once you're back online.");
      return;
    }
    router.refresh();
  }

  async function removeWorker(workerId: string) {
    await fetch(`/api/projects/${projectId}/hours-on-site/${sheet.id}/workers`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workerId })
    });
    router.refresh();
  }

  async function handleSendEmail() {
    if (recipientSelection === ONE_OFF_SENTINEL && !oneOffEmail.trim()) {
      setSendResult("Enter an email address.");
      return;
    }
    setIsSending(true);
    setSendResult(null);
    const response = await fetch(`/api/projects/${projectId}/hours-on-site/${sheet.id}/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        recipientSelection === ONE_OFF_SENTINEL ? { email: oneOffEmail.trim() } : { contactId: recipientSelection }
      )
    });
    setIsSending(false);
    const body = await response.json().catch(() => null);
    setSendResult(response.ok ? "Sent." : typeof body?.error === "string" ? body.error : "Could not send.");
  }

  const exactMatch = workerResults.find((w) => w.name.toLowerCase() === workerQuery.trim().toLowerCase());

  return (
    <div className="flex flex-col gap-4">
      <div>
        <a href={`/m/dayworks/${projectId}`} className="text-xs font-medium text-[#4c739a] dark:text-slate-400">
          &larr; {sheet.projectName}
        </a>
        <h1 className="text-lg font-bold">Hours on Site</h1>
        <p className="text-sm text-[#4c739a] dark:text-slate-400">
          {sheet.variationItem ? `${sheet.variationItem.reference} — ${sheet.variationItem.title}` : sheet.comments || "No description"}
        </p>
      </div>

      {offlineNotice && (
        <p className="text-xs text-amber-700 dark:text-amber-400 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 px-3 py-2">
          {offlineNotice}
        </p>
      )}

      <div className="rounded-xl border border-[#e7edf3] dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col gap-3">
        <p className="text-xs font-bold uppercase tracking-wide text-[#4c739a] dark:text-slate-400">
          Times — always editable
        </p>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Start time
          <input
            type="datetime-local"
            value={startedAt}
            onChange={(event) => setStartedAt(event.target.value)}
            onBlur={saveTimes}
            className="h-11 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Finish time
          <input
            type="datetime-local"
            value={finishedAt}
            onChange={(event) => setFinishedAt(event.target.value)}
            onBlur={saveTimes}
            className="h-11 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Total hours <span className="font-normal text-[#4c739a] dark:text-slate-400">(edit to correct, e.g. deduct a lunch break)</span>
          <input
            type="number"
            min={0}
            step="0.25"
            value={totalHours}
            onChange={(event) => setTotalHours(event.target.value)}
            onBlur={saveTimes}
            className="h-11 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>
        {isSavingTimes && <p className="text-xs text-[#4c739a] dark:text-slate-400">Saving...</p>}
        {!sheet.finishedAt && (
          <button
            onClick={handleFinishNow}
            disabled={isFinishing}
            className="h-11 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
          >
            {isFinishing ? "Finishing..." : "Finish now"}
          </button>
        )}
      </div>

      <div className="rounded-xl border border-[#e7edf3] dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col gap-3">
        <p className="text-xs font-bold uppercase tracking-wide text-[#4c739a] dark:text-slate-400">Workers on site</p>
        {sheet.workers.length === 0 ? (
          <p className="text-sm text-[#4c739a] dark:text-slate-400">No workers added yet.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {sheet.workers.map((worker) => (
              <div key={worker.id} className="flex items-center justify-between text-sm">
                <span>{worker.name}</span>
                <button onClick={() => removeWorker(worker.id)} className="text-xs text-red-600 hover:underline">
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-1">
          <input
            value={workerQuery}
            onChange={(event) => setWorkerQuery(event.target.value)}
            placeholder="Search or add a worker..."
            className="h-11 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          {workerQuery.trim() && (
            <div className="flex flex-col gap-1 mt-1">
              {workerResults
                .filter((w) => !sheet.workers.some((sw) => sw.id === w.id))
                .map((w) => (
                  <button
                    key={w.id}
                    onClick={() => addWorker(w.id)}
                    disabled={isAddingWorker}
                    className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-medium text-left px-3 hover:bg-[#e7edf3] dark:hover:bg-slate-800 disabled:opacity-60"
                  >
                    {w.name}
                  </button>
                ))}
              {!exactMatch && (
                <button
                  onClick={() => addWorker(undefined, workerQuery.trim())}
                  disabled={isAddingWorker}
                  className="h-10 rounded-lg border border-dashed border-primary text-primary text-sm font-bold text-left px-3 disabled:opacity-60"
                >
                  {isAddingWorker ? "Adding..." : `+ Add "${workerQuery.trim()}" as a new worker`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-[#e7edf3] dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col gap-3">
        <p className="text-xs font-bold uppercase tracking-wide text-[#4c739a] dark:text-slate-400">Share</p>
        <a
          href={`/api/projects/${projectId}/hours-on-site/${sheet.id}/pdf`}
          target="_blank"
          rel="noreferrer"
          className="h-11 flex items-center justify-center rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-bold"
        >
          View / Download PDF
        </a>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Email to
          <select
            value={recipientSelection}
            onChange={(event) => setRecipientSelection(event.target.value)}
            className="h-11 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {eligibleContacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.name} {contact.role ? `(${contact.role})` : ""} — {contact.email}
              </option>
            ))}
            <option value={ONE_OFF_SENTINEL}>Other (enter email)...</option>
          </select>
        </label>
        {recipientSelection === ONE_OFF_SENTINEL && (
          <input
            type="email"
            value={oneOffEmail}
            onChange={(event) => setOneOffEmail(event.target.value)}
            placeholder="name@example.com"
            className="h-11 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        )}
        <button
          onClick={handleSendEmail}
          disabled={isSending}
          className="h-11 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
        >
          {isSending ? "Sending..." : "Email as PDF"}
        </button>
        {sendResult && <p className="text-xs text-[#4c739a] dark:text-slate-400">{sendResult}</p>}
      </div>
    </div>
  );
}
