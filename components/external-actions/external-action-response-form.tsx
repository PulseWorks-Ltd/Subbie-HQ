"use client";

import { useEffect, useState } from "react";
import { EXTERNAL_ACTION_TYPE_LABELS } from "@/lib/external-action-types";

type ValueSnapshot = {
  combinedTotal: number;
  labourTotal: number;
  materialsTotal: number;
  materialsMarkupTotal: number;
  plantTotal: number;
  dayWorksSheets: { fileName: string; createdAt: string }[];
  previousPackage: { grandTotal: number; sentAt: string } | null;
  hoursOnSite: {
    totalHours: number | null;
    workerNames: string[];
    startedAt: string;
    finishedAt: string | null;
    comments: string | null;
    variationItemReference: string | null;
    variationItemTitle: string | null;
  } | null;
  delayEvent: {
    cause: string;
    clauseReference: string | null;
    startDate: string;
    endDate: string | null;
    daysClaimed: number | null;
  } | null;
};

type PublicContext = {
  type: "acknowledge" | "approve" | "sign" | "confirm" | "reject" | "comment";
  message: string | null;
  valueSnapshot: ValueSnapshot | null;
  package: { fileName: string } | null;
  status: "pending" | "responded" | "expired";
  expiresAt: string;
  recipientName: string | null;
  senderName: string;
  source:
    | { kind: "variation_item"; reference: string; title: string; description: string | null; isSiteInstruction: boolean }
    | { kind: "day_works_sheet"; fileName: string; createdAt: string; itemReference: string; itemTitle: string }
    | {
        kind: "hours_on_site";
        startedAt: string;
        finishedAt: string | null;
        totalHours: number | null;
        workerNames: string[];
        comments: string | null;
        itemReference: string | null;
        itemTitle: string | null;
      }
    | {
        kind: "delay_event";
        cause: string;
        clauseReference: string | null;
        startDate: string;
        endDate: string | null;
        daysClaimed: number | null;
        itemReference: string | null;
        itemTitle: string | null;
      };
  existingResponse: { choice: "approved" | "rejected" | null; name: string | null; comment: string | null; respondedAt: string } | null;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

function formatCurrency(amount: number) {
  return amount.toLocaleString("en-NZ", { style: "currency", currency: "NZD" });
}

// The entire public, no-login surface for an External Action (Task 3) —
// fetches context on mount, renders it, and submits the response. Never
// receives or displays anything beyond this one request's own intended
// context (see the API route / lib/external-action.ts).
export function ExternalActionResponseForm({ token }: { token: string }) {
  const [context, setContext] = useState<PublicContext | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [choice, setChoice] = useState<"approved" | "rejected" | "">("");
  const [comment, setComment] = useState("");
  const [signConfirmed, setSignConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch(`/api/external-actions/${token}`)
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          setLoadError(body.error ?? "This link isn't valid.");
          return;
        }
        setContext(body.context);
      })
      .catch(() => setLoadError("Could not load this request."));
  }, [token]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!context) return;
    setSubmitError(null);

    if (context.type === "sign" && !signConfirmed) {
      setSubmitError("Tick the confirmation box first.");
      return;
    }
    if (context.type === "approve" && !choice) {
      setSubmitError("Choose Approve or Reject.");
      return;
    }
    if ((context.type === "reject" || context.type === "comment") && !comment.trim()) {
      setSubmitError(context.type === "reject" ? "Enter a reason." : "Enter a comment.");
      return;
    }

    setIsSubmitting(true);
    const response = await fetch(`/api/external-actions/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        choice: context.type === "approve" ? choice : context.type === "reject" ? "rejected" : undefined,
        name,
        comment: comment.trim() || undefined
      })
    });
    setIsSubmitting(false);

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setSubmitError(typeof body.error === "string" ? body.error : "Could not submit your response.");
      return;
    }
    setSubmitted(true);
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-[#e7edf3] dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center">
        <h1 className="text-lg font-bold mb-2">This link isn't available</h1>
        <p className="text-sm text-[#4c739a] dark:text-slate-400">{loadError}</p>
      </div>
    );
  }

  if (!context) {
    return <p className="text-center text-sm text-[#4c739a] dark:text-slate-400">Loading...</p>;
  }

  if (submitted || context.existingResponse) {
    const response = context.existingResponse;
    return (
      <div className="rounded-xl border border-[#e7edf3] dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center">
        <h1 className="text-lg font-bold mb-2">Thanks — recorded</h1>
        <p className="text-sm text-[#4c739a] dark:text-slate-400">
          {submitted
            ? "Your response has been recorded."
            : response
              ? `Recorded${response.name ? ` from ${response.name}` : ""} on ${formatDate(response.respondedAt)}.`
              : "This request has already been responded to."}
        </p>
      </div>
    );
  }

  const typeLabel = EXTERNAL_ACTION_TYPE_LABELS[context.type];
  const sourceLabel =
    context.source.kind === "variation_item"
      ? `${context.source.isSiteInstruction ? "Site Instruction" : "Variation"} ${context.source.reference} — ${context.source.title}`
      : context.source.kind === "day_works_sheet"
        ? `Day Works Sheet — ${context.source.fileName} (from ${context.source.itemReference} — ${context.source.itemTitle})`
        : context.source.kind === "delay_event"
          ? `Delay/EOT — ${context.source.cause}`
          : `Hours on Site${
              context.source.itemReference ? ` — ${context.source.itemReference} — ${context.source.itemTitle}` : ""
            }`;
  const snapshot = context.valueSnapshot;

  return (
    <div className="rounded-xl border border-[#e7edf3] dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
      <p className="text-xs font-bold uppercase tracking-wide text-primary mb-1">{typeLabel} requested</p>
      <h1 className="text-lg font-bold mb-1">
        {context.recipientName ? `Hi ${context.recipientName},` : "Hi,"}
      </h1>
      <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-4">
        {context.senderName} has requested your {typeLabel.toLowerCase()} on {sourceLabel}:
      </p>

      {/* Primary content — the actual ask, drafted and reviewed by the
          sender before this was sent (see RequestActionDialog). This is
          what replaced the original bug: the source record's own
          description used to be shown here instead, which is meaningless
          when it's the Main Contractor's own instruction text. */}
      {context.message && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 mb-4">
          <p className="text-sm whitespace-pre-wrap">{context.message}</p>
        </div>
      )}

      {context.package && (
        <a
          href={`/api/external-actions/${token}/package-file`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-lg border border-[#e7edf3] dark:border-slate-700 p-3 mb-4 text-sm font-bold text-primary hover:bg-[#f6f7f8] dark:hover:bg-slate-800"
        >
          <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
          View / Download Variation Package — {context.package.fileName}
        </a>
      )}

      {context.source.kind === "hours_on_site" && (
        <a
          href={`/api/external-actions/${token}/hours-on-site-file`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-lg border border-[#e7edf3] dark:border-slate-700 p-3 mb-4 text-sm font-bold text-primary hover:bg-[#f6f7f8] dark:hover:bg-slate-800"
        >
          <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
          View / Download Hours on Site sheet
        </a>
      )}

      {snapshot?.hoursOnSite && (
        <div className="rounded-lg bg-[#f6f7f8] dark:bg-slate-800 p-3 mb-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[#4c739a] dark:text-slate-400 mb-2">
            Hours &amp; workers
          </p>
          <p className="text-sm mb-1">
            {new Date(snapshot.hoursOnSite.startedAt).toLocaleString("en-NZ")} —{" "}
            {snapshot.hoursOnSite.finishedAt ? new Date(snapshot.hoursOnSite.finishedAt).toLocaleString("en-NZ") : "not yet finished"}
          </p>
          <p className="text-sm font-bold mb-2">
            Total hours: {snapshot.hoursOnSite.totalHours != null ? `${snapshot.hoursOnSite.totalHours.toFixed(2)} hrs` : "—"}
          </p>
          {snapshot.hoursOnSite.comments && !snapshot.hoursOnSite.variationItemReference && (
            <p className="text-xs text-[#4c739a] dark:text-slate-400 mb-2">{snapshot.hoursOnSite.comments}</p>
          )}
          <p className="text-xs text-[#4c739a] dark:text-slate-400 mb-1">Workers on site:</p>
          {snapshot.hoursOnSite.workerNames.length === 0 ? (
            <p className="text-sm text-[#4c739a] dark:text-slate-400">(none recorded)</p>
          ) : (
            <ul className="text-sm">
              {snapshot.hoursOnSite.workerNames.map((name, index) => (
                <li key={index}>• {name}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {snapshot?.delayEvent && (
        <div className="rounded-lg bg-[#f6f7f8] dark:bg-slate-800 p-3 mb-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[#4c739a] dark:text-slate-400 mb-2">Delay / Extension of Time</p>
          <p className="text-sm mb-1">Cause: {snapshot.delayEvent.cause}</p>
          <p className="text-sm mb-1">
            Period: {formatDate(snapshot.delayEvent.startDate)}
            {snapshot.delayEvent.endDate ? ` – ${formatDate(snapshot.delayEvent.endDate)}` : " (ongoing)"}
          </p>
          {snapshot.delayEvent.clauseReference && <p className="text-sm mb-1">Notice given under {snapshot.delayEvent.clauseReference}.</p>}
          <p className="text-sm font-bold">
            {snapshot.delayEvent.daysClaimed != null ? `Claiming ${snapshot.delayEvent.daysClaimed} day(s) EOT` : "No day count assessed yet"}
          </p>
        </div>
      )}

      {context.source.kind !== "hours_on_site" && context.source.kind !== "delay_event" && snapshot && (snapshot.combinedTotal > 0 || snapshot.dayWorksSheets.length > 0) && (
        <div className="rounded-lg bg-[#f6f7f8] dark:bg-slate-800 p-3 mb-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[#4c739a] dark:text-slate-400 mb-2">
            Value &amp; evidence
          </p>
          {snapshot.dayWorksSheets.length > 0 && (
            <ul className="text-sm mb-2">
              {snapshot.dayWorksSheets.map((sheet, index) => (
                <li key={index} className="flex items-center justify-between gap-2">
                  <span className="truncate">{sheet.fileName}</span>
                  <span className="text-[#4c739a] dark:text-slate-400 shrink-0">{formatDate(sheet.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
          {(snapshot.materialsTotal > 0 || snapshot.plantTotal > 0) && (
            <p className="text-xs text-[#4c739a] dark:text-slate-400 mb-2">
              Labour {formatCurrency(snapshot.labourTotal)} · Materials{" "}
              {formatCurrency(snapshot.materialsTotal + snapshot.materialsMarkupTotal)} · Plant {formatCurrency(snapshot.plantTotal)}
            </p>
          )}
          {snapshot.previousPackage && (
            <p className="text-xs text-[#4c739a] dark:text-slate-400 mb-2">
              New since the last approval request ({formatDate(snapshot.previousPackage.sentAt)}):{" "}
              {formatCurrency(snapshot.combinedTotal - snapshot.previousPackage.grandTotal)}
            </p>
          )}
          {snapshot.combinedTotal > 0 ? (
            <p className="text-sm font-bold pt-2 border-t border-[#e7edf3] dark:border-slate-700">
              Cumulative recorded value to date: {formatCurrency(snapshot.combinedTotal)}
            </p>
          ) : (
            <p className="text-sm text-[#4c739a] dark:text-slate-400 pt-2 border-t border-[#e7edf3] dark:border-slate-700">
              No cost has been recorded against this yet.
            </p>
          )}
        </div>
      )}

      {/* Secondary/background context only — never the primary framing of
          what's being asked (Task 2.2). */}
      {context.source.kind === "variation_item" && context.source.description && (
        <details className="mb-4 text-sm">
          <summary className="cursor-pointer text-[#4c739a] dark:text-slate-400 hover:text-primary">
            Original instruction
          </summary>
          <p className="mt-2 text-[#4c739a] dark:text-slate-400">{context.source.description}</p>
        </details>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Your name
          <input
            type="text"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>

        {context.type === "approve" && (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setChoice("approved")}
              className={`flex-1 h-10 rounded-lg text-sm font-bold border ${
                choice === "approved" ? "bg-green-600 text-white border-green-600" : "border-[#e7edf3] dark:border-slate-700"
              }`}
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => setChoice("rejected")}
              className={`flex-1 h-10 rounded-lg text-sm font-bold border ${
                choice === "rejected" ? "bg-red-600 text-white border-red-600" : "border-[#e7edf3] dark:border-slate-700"
              }`}
            >
              Reject
            </button>
          </div>
        )}

        {context.type === "sign" && (
          <>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={signConfirmed}
                onChange={(event) => setSignConfirmed(event.target.checked)}
                className="mt-0.5"
              />
              I confirm the above is accurate
            </label>
            <p className="text-xs text-[#4c739a] dark:text-slate-400">
              This records your typed name as an acknowledgement with a timestamp ({formatDate(new Date().toISOString())}) — it
              is not a certified electronic signature.
            </p>
          </>
        )}

        {(context.type === "approve" || context.type === "comment") && (
          <label className="flex flex-col gap-1 text-sm font-medium">
            Comment <span className="font-normal text-[#4c739a] dark:text-slate-400">{context.type === "comment" ? "" : "(optional)"}</span>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={3}
              required={context.type === "comment"}
              className="rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
        )}

        {context.type === "reject" && (
          <label className="flex flex-col gap-1 text-sm font-medium">
            Reason
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={3}
              required
              className="rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
        )}

        {submitError && <p className="text-sm text-red-600">{submitError}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="h-10 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
        >
          {isSubmitting ? "Submitting..." : context.type === "reject" ? "Submit rejection" : `Submit ${typeLabel.toLowerCase()}`}
        </button>
      </form>
    </div>
  );
}
