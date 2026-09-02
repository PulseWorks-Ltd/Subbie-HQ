"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { postWithOfflineRetry } from "@/lib/offline-retry-client";

type SiteInstructionOption = { id: string; reference: string; title: string };
type SheetSummary = {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  totalHours: number | null;
  variationItem: SiteInstructionOption | null;
  comments: string | null;
  workerCount: number;
};

function formatElapsed(startedAt: string, now: number): string {
  const ms = now - new Date(startedAt).getTime();
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

export function HoursOnSiteProjectView({
  projectId,
  projectName,
  activeSheet,
  sheets,
  openSiteInstructions
}: {
  projectId: string;
  projectName: string;
  activeSheet: { id: string; startedAt: string } | null;
  sheets: SheetSummary[];
  openSiteInstructions: SiteInstructionOption[];
}) {
  const router = useRouter();
  const [variationItemId, setVariationItemId] = useState("");
  const [comments, setComments] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [offlineNotice, setOfflineNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!activeSheet) return;
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, [activeSheet]);

  async function handleStart(event: React.FormEvent) {
    event.preventDefault();
    setIsStarting(true);
    setOfflineNotice(null);
    const result = await postWithOfflineRetry(`/api/projects/${projectId}/hours-on-site`, {
      variationItemId: variationItemId || undefined,
      comments: comments.trim() || undefined
    });
    setIsStarting(false);
    if (result.ok && result.queued) {
      setOfflineNotice("You're offline — Start has been saved and will sync automatically once you're back online.");
      return;
    }
    router.refresh();
  }

  async function handleFinish() {
    if (!activeSheet) return;
    setIsFinishing(true);
    setOfflineNotice(null);
    const result = await postWithOfflineRetry(`/api/projects/${projectId}/hours-on-site/${activeSheet.id}/finish`, {});
    setIsFinishing(false);
    if (result.ok && result.queued) {
      setOfflineNotice("You're offline — Finish has been saved and will sync automatically once you're back online.");
      return;
    }
    router.push(`/m/dayworks/${projectId}/${activeSheet.id}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <a href="/m/dayworks" className="text-xs font-medium text-[#4c739a] dark:text-slate-400">
          &larr; Hours on Site
        </a>
        <h1 className="text-lg font-bold">{projectName}</h1>
      </div>

      {offlineNotice && (
        <p className="text-xs text-amber-700 dark:text-amber-400 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 px-3 py-2">
          {offlineNotice}
        </p>
      )}

      {activeSheet ? (
        <div className="rounded-xl border border-primary bg-primary/5 p-4 flex flex-col items-center gap-3">
          <p className="text-xs font-bold uppercase tracking-wide text-primary">Session running</p>
          <p className="text-3xl font-black tabular-nums">{formatElapsed(activeSheet.startedAt, now)}</p>
          <p className="text-xs text-[#4c739a] dark:text-slate-400">
            Started {new Date(activeSheet.startedAt).toLocaleTimeString("en-NZ", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <button
            onClick={handleFinish}
            disabled={isFinishing}
            className="h-12 w-full rounded-lg bg-primary text-white text-base font-bold hover:bg-primary/90 disabled:opacity-60"
          >
            {isFinishing ? "Finishing..." : "Finish"}
          </button>
        </div>
      ) : (
        <form onSubmit={handleStart} className="rounded-xl border border-[#e7edf3] dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Site Instruction <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span>
            <select
              value={variationItemId}
              onChange={(event) => setVariationItemId(event.target.value)}
              className="h-11 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">Not linked to an SI</option>
              {openSiteInstructions.map((si) => (
                <option key={si.id} value={si.id}>
                  {si.reference} — {si.title}
                </option>
              ))}
            </select>
          </label>
          {!variationItemId && (
            <label className="flex flex-col gap-1 text-sm font-medium">
              Comments <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span>
              <textarea
                value={comments}
                onChange={(event) => setComments(event.target.value)}
                rows={2}
                placeholder="What's this work for?"
                className="rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>
          )}
          <button
            type="submit"
            disabled={isStarting}
            className="h-12 rounded-lg bg-primary text-white text-base font-bold hover:bg-primary/90 disabled:opacity-60"
          >
            {isStarting ? "Starting..." : "Start"}
          </button>
        </form>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-[#4c739a] dark:text-slate-400">Past sheets</p>
        {sheets.length === 0 ? (
          <p className="text-sm text-[#4c739a] dark:text-slate-400">No sheets yet.</p>
        ) : (
          sheets.map((sheet) => (
            <a
              key={sheet.id}
              href={`/m/dayworks/${projectId}/${sheet.id}`}
              className="rounded-lg border border-[#e7edf3] dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 active:bg-[#e7edf3] dark:active:bg-slate-800"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm">
                  {sheet.variationItem ? `${sheet.variationItem.reference} — ${sheet.variationItem.title}` : sheet.comments || "No description"}
                </span>
                {!sheet.finishedAt && (
                  <span className="text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">In progress</span>
                )}
              </div>
              <p className="text-xs text-[#4c739a] dark:text-slate-400 mt-0.5">
                {formatDate(sheet.startedAt)}
                {sheet.totalHours != null && ` · ${sheet.totalHours.toFixed(2)} hrs`}
                {` · ${sheet.workerCount} worker${sheet.workerCount === 1 ? "" : "s"}`}
              </p>
            </a>
          ))
        )}
      </div>
    </div>
  );
}
