"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { VariationAutomationMode, VariationRecipientRole, VariationScheduleRun } from "@prisma/client";

type ContactOption = { id: string; name: string; email: string | null; role: string | null };
type RecipientRow = {
  id: string;
  role: VariationRecipientRole;
  name: string;
  email: string;
  mainContractorContactId: string | null;
  contact: { name: string; email: string | null } | null;
};

const ONE_OFF_SENTINEL = "__one_off__";

const MODE_INFO: Record<VariationAutomationMode, { label: string; description: string }> = {
  manual: {
    label: "Manual",
    description: "Nothing is ever generated or sent automatically — every Variation Package still needs Request Approval clicked by hand."
  },
  automatic_with_approval: {
    label: "Automatic with approval",
    description:
      "The Package is auto-generated and the team is warned 2 working days before the real deadline, with time to review and cancel before it actually sends externally."
  },
  fully_automatic: {
    label: "Fully automatic",
    description:
      "The Package is generated AND sent externally on the deadline with no human review step at all. Only enable this once the recipient list below is confirmed correct."
  }
};

function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

const RUN_STATUS_LABEL: Record<string, string> = {
  pending_warning: "Scheduled",
  warned: "Warned — awaiting send",
  sent: "Sent",
  cancelled: "Cancelled",
  skipped_no_items: "Skipped (no eligible items)"
};

export function VariationAutomationSection({
  projectId,
  mode: initialMode,
  contacts,
  recipients: initialRecipients,
  scheduleRuns
}: {
  projectId: string;
  mode: VariationAutomationMode;
  contacts: ContactOption[];
  recipients: RecipientRow[];
  scheduleRuns: VariationScheduleRun[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<VariationAutomationMode>(initialMode);
  const [isSavingMode, setIsSavingMode] = useState(false);
  const [recipientSelection, setRecipientSelection] = useState(contacts[0]?.id ?? ONE_OFF_SENTINEL);
  const [recipientRole, setRecipientRole] = useState<VariationRecipientRole>("to");
  const [oneOffName, setOneOffName] = useState("");
  const [oneOffEmail, setOneOffEmail] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancellingRunId, setCancellingRunId] = useState<string | null>(null);

  const isOneOff = recipientSelection === ONE_OFF_SENTINEL;
  const eligibleContacts = contacts.filter((contact) => contact.email);

  async function saveMode(next: VariationAutomationMode) {
    setMode(next);
    setIsSavingMode(true);
    await fetch(`/api/projects/${projectId}/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variationAutomationMode: next })
    });
    setIsSavingMode(false);
    router.refresh();
  }

  async function addRecipient() {
    setError(null);
    if (isOneOff && (!oneOffName.trim() || !oneOffEmail.trim())) {
      setError("Enter a name and email address.");
      return;
    }
    setIsAdding(true);
    const response = await fetch(`/api/projects/${projectId}/variation-schedule-recipients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: recipientRole,
        mainContractorContactId: isOneOff ? undefined : recipientSelection,
        name: isOneOff ? oneOffName.trim() : undefined,
        email: isOneOff ? oneOffEmail.trim() : undefined
      })
    });
    setIsAdding(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(typeof body?.error === "string" ? body.error : "Could not add this recipient.");
      return;
    }
    setOneOffName("");
    setOneOffEmail("");
    router.refresh();
  }

  async function removeRecipient(recipientId: string) {
    await fetch(`/api/projects/${projectId}/variation-schedule-recipients/${recipientId}`, { method: "DELETE" });
    router.refresh();
  }

  async function cancelRun(runId: string) {
    setCancellingRunId(runId);
    await fetch(`/api/projects/${projectId}/variation-schedule-runs/${runId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cancel: true })
    });
    setCancellingRunId(null);
    router.refresh();
  }

  const activeRun = scheduleRuns.find((run) => run.status === "pending_warning" || run.status === "warned");
  const toRecipients = initialRecipients.filter((r) => r.role === "to");
  const ccRecipients = initialRecipients.filter((r) => r.role === "cc");

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#cfdbe7] dark:border-slate-800 p-5 flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-bold">Variation Package automation</h3>
        <p className="text-xs text-[#4c739a] dark:text-slate-400">
          Uses the Variation/SI submission schedule set in Contract Terms above to auto-generate and, depending on
          mode, auto-send Variation Packages each month.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {(Object.keys(MODE_INFO) as VariationAutomationMode[]).map((key) => (
          <label
            key={key}
            className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer ${
              mode === key ? "border-primary bg-primary/5" : "border-[#e7edf3] dark:border-slate-700"
            }`}
          >
            <input
              type="radio"
              name="variationAutomationMode"
              checked={mode === key}
              onChange={() => saveMode(key)}
              disabled={isSavingMode}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-bold">{MODE_INFO[key].label}</span>
              <span className="block text-xs text-[#4c739a] dark:text-slate-400">{MODE_INFO[key].description}</span>
            </span>
          </label>
        ))}
      </div>

      {activeRun && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 px-4 py-3">
          <p className="text-sm text-amber-700 dark:text-amber-400">
            <strong>{RUN_STATUS_LABEL[activeRun.status]}</strong> — next automatic send scheduled for{" "}
            {formatDate(activeRun.scheduledSendAt)}
            {activeRun.warningAt && activeRun.status === "pending_warning" && (
              <> (warning due {formatDate(activeRun.warningAt)})</>
            )}
            .
          </p>
          <button
            onClick={() => cancelRun(activeRun.id)}
            disabled={cancellingRunId === activeRun.id}
            className="h-8 px-3 rounded-lg bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs font-bold hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-60 shrink-0"
          >
            {cancellingRunId === activeRun.id ? "Cancelling..." : "Cancel this cycle"}
          </button>
        </div>
      )}

      {scheduleRuns.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer font-medium text-[#4c739a] dark:text-slate-400">Cycle history</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {scheduleRuns.map((run) => (
              <li key={run.id} className="flex items-center justify-between text-[#4c739a] dark:text-slate-400">
                <span>{formatDate(run.scheduledSendAt)}</span>
                <span>{RUN_STATUS_LABEL[run.status]}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="pt-2 border-t border-[#e7edf3] dark:border-slate-800 flex flex-col gap-3">
        <div>
          <label className="text-sm font-medium">Payment Claim / Variation Recipients</label>
          <p className="text-xs text-[#4c739a] dark:text-slate-400">
            Who automated sends go to. &quot;To&quot; recipients get their own actionable approval link; &quot;Cc&quot;
            recipients get an FYI copy only.
          </p>
        </div>

        {toRecipients.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-wide text-[#4c739a] dark:text-slate-400">To</span>
            {toRecipients.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span>
                  {r.contact?.name ?? r.name} — {r.contact?.email ?? r.email}
                </span>
                <button onClick={() => removeRecipient(r.id)} className="text-xs text-red-600 hover:underline">
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
        {ccRecipients.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-wide text-[#4c739a] dark:text-slate-400">Cc</span>
            {ccRecipients.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span>
                  {r.contact?.name ?? r.name} — {r.contact?.email ?? r.email}
                </span>
                <button onClick={() => removeRecipient(r.id)} className="text-xs text-red-600 hover:underline">
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium">
            Role
            <select
              value={recipientRole}
              onChange={(event) => setRecipientRole(event.target.value as VariationRecipientRole)}
              className="h-9 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="to">To</option>
              <option value="cc">Cc</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium flex-1 min-w-[10rem]">
            Recipient
            <select
              value={recipientSelection}
              onChange={(event) => setRecipientSelection(event.target.value)}
              className="h-9 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {eligibleContacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name} {contact.role ? `(${contact.role})` : ""} — {contact.email}
                </option>
              ))}
              <option value={ONE_OFF_SENTINEL}>Other (enter details)...</option>
            </select>
          </label>
          {isOneOff && (
            <>
              <label className="flex flex-col gap-1 text-xs font-medium">
                Name
                <input
                  value={oneOffName}
                  onChange={(event) => setOneOffName(event.target.value)}
                  className="h-9 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium">
                Email
                <input
                  type="email"
                  value={oneOffEmail}
                  onChange={(event) => setOneOffEmail(event.target.value)}
                  className="h-9 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </label>
            </>
          )}
          <button
            onClick={addRecipient}
            disabled={isAdding}
            className="h-9 px-3 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
          >
            {isAdding ? "Adding..." : "Add"}
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
