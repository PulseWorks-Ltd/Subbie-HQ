"use client";

import { useState } from "react";
import type { IncomingEmailRow } from "@/components/incoming-emails/incoming-emails-view";

function formatDate(date: Date) {
  return new Date(date).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function IncomingEmailCard({
  email,
  onReview,
  onChanged
}: {
  email: IncomingEmailRow;
  onReview: () => void;
  onChanged: () => void;
}) {
  const [isDismissing, setIsDismissing] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  async function handleDismiss() {
    if (!confirm("Dismiss this email? It won't be filed anywhere, but the record is kept in case you need it later.")) {
      return;
    }
    setIsDismissing(true);
    await fetch(`/api/organisation/incoming-emails/${email.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dismiss" })
    });
    setIsDismissing(false);
    onChanged();
  }

  async function handleRetryClassification() {
    setIsRetrying(true);
    await fetch(`/api/organisation/incoming-emails/${email.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reclassify" })
    });
    setIsRetrying(false);
    onChanged();
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-[#e7edf3] dark:border-slate-800 rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold truncate">{email.subject}</p>
          <p className="text-xs text-[#4c739a] dark:text-slate-400">
            From {email.sender}
            {email.ccAddresses.length > 0 && ` · CC: ${email.ccAddresses.join(", ")}`}
          </p>
        </div>
        <p className="text-xs text-[#4c739a] dark:text-slate-400 shrink-0">{formatDate(email.receivedAt)}</p>
      </div>

      {email.classificationError ? (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 p-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold text-red-700 dark:text-red-400">AI classification failed</p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{email.classificationError}</p>
            <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">
              This is different from "nothing detected" — the AI call itself didn't complete. You can still file this
              manually, or try again below.
            </p>
          </div>
          <button
            onClick={handleRetryClassification}
            disabled={isRetrying}
            className="h-8 px-3 rounded-lg border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 text-xs font-bold disabled:opacity-60 shrink-0"
          >
            {isRetrying ? "Retrying..." : "Retry"}
          </button>
        </div>
      ) : (
        <>
          {email.aiSummary && <p className="text-sm text-[#0d141b] dark:text-slate-200">{email.aiSummary}</p>}

          <div className="flex flex-wrap gap-2">
            <span
              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold ${
                email.suggestedProject
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                  : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              Project: {email.suggestedProject?.name ?? "not detected"}
              {email.suggestedProject && email.suggestedProjectConfidence != null && (
                <span className="ml-1 opacity-70">({Math.round(email.suggestedProjectConfidence * 100)}%)</span>
              )}
            </span>
            <span
              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold ${
                email.suggestedType
                  ? "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                  : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              Type: {email.suggestedType ?? "not detected"}
            </span>
            {email.suggestedVariationItem && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                Linked: {email.suggestedVariationItem.reference}
              </span>
            )}
          </div>
        </>
      )}

      {email.attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {email.attachments.map((attachment) => (
            <a
              key={attachment.id}
              href={`/api/organisation/incoming-emails/${email.id}/attachments/${attachment.id}/file`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-xs font-medium hover:bg-[#e7edf3] dark:hover:bg-slate-800"
            >
              <span className="material-symbols-outlined text-sm">attachment</span>
              {attachment.fileName}
            </a>
          ))}
        </div>
      )}

      <div className="flex gap-2 justify-end pt-1">
        <button
          onClick={handleDismiss}
          disabled={isDismissing}
          className="h-9 px-3 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-xs font-bold disabled:opacity-60"
        >
          {isDismissing ? "Dismissing..." : "Dismiss"}
        </button>
        <button onClick={onReview} className="h-9 px-4 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90">
          Review &amp; file
        </button>
      </div>
    </div>
  );
}
