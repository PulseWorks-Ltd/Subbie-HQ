"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EXTERNAL_ACTION_TYPES, EXTERNAL_ACTION_TYPE_LABELS, EXTERNAL_ACTION_TYPE_DESCRIPTIONS } from "@/lib/external-action-types";

type ContactOption = { id: string; name: string; email: string | null; role: string | null };

const ONE_OFF_SENTINEL = "__one_off__";

// Sends a request for an external (no-login) recipient to Acknowledge,
// Approve, Sign, Confirm, Reject, or Comment on this SI/Variation or Day
// Works Sheet (Task 2.1). Reuses the exact recipient shape the existing
// External Update / outbound-email flows already use — a saved Main
// Contractor contact resolved to its CURRENT email server-side, or a
// one-off typed address — just as a single choice rather than a
// multi-select, since one request goes to one recipient.
export function RequestActionDialog({
  projectId,
  target,
  contacts
}: {
  projectId: string;
  target: { variationItemId: string } | { dayWorksSheetId: string };
  contacts: ContactOption[];
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<(typeof EXTERNAL_ACTION_TYPES)[number]>("acknowledge");
  const [recipientSelection, setRecipientSelection] = useState(contacts[0]?.id ?? ONE_OFF_SENTINEL);
  const [oneOffEmail, setOneOffEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  const eligibleContacts = contacts.filter((contact) => contact.email);
  const isOneOff = recipientSelection === ONE_OFF_SENTINEL;

  function reset() {
    setType("acknowledge");
    setRecipientSelection(contacts[0]?.id ?? ONE_OFF_SENTINEL);
    setOneOffEmail("");
    setMessage("");
    setError(null);
  }

  async function handleSend() {
    if (isOneOff && !oneOffEmail.trim()) {
      setError("Enter an email address.");
      return;
    }
    setError(null);
    setIsSubmitting(true);

    const response = await fetch(`/api/projects/${projectId}/external-actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...target,
        type,
        message: message.trim() || undefined,
        contactId: isOneOff ? undefined : recipientSelection,
        email: isOneOff ? oneOffEmail.trim() : undefined
      })
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(typeof body?.error === "string" ? body.error : "Could not send this request.");
      return;
    }

    setIsOpen(false);
    reset();
    setSentMessage("Request sent.");
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="text-xs font-bold text-primary hover:underline"
      >
        Request Action
      </button>
      {sentMessage && <span className="text-xs text-green-600 dark:text-green-400 ml-2">{sentMessage}</span>}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="relative w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 p-5 shadow-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-bold mb-1">Request Action</h3>
            <p className="text-xs text-[#4c739a] dark:text-slate-400 mb-3">
              Sends a secure, no-login link by email. The recipient's response is recorded back here as evidence — it
              does not automatically change any status.
            </p>

            <label className="flex flex-col gap-1 text-xs font-medium mb-1">
              Action type
              <select
                value={type}
                onChange={(event) => setType(event.target.value as (typeof EXTERNAL_ACTION_TYPES)[number])}
                className="h-9 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {EXTERNAL_ACTION_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {EXTERNAL_ACTION_TYPE_LABELS[option]}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-[11px] text-[#4c739a] dark:text-slate-400 mb-3">{EXTERNAL_ACTION_TYPE_DESCRIPTIONS[type]}</p>

            <label className="flex flex-col gap-1 text-xs font-medium mb-3">
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
                <option value={ONE_OFF_SENTINEL}>Other (enter email)...</option>
              </select>
            </label>

            {isOneOff && (
              <label className="flex flex-col gap-1 text-xs font-medium mb-3">
                Email address
                <input
                  type="email"
                  value={oneOffEmail}
                  onChange={(event) => setOneOffEmail(event.target.value)}
                  placeholder="name@example.com"
                  className="h-9 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </label>
            )}

            <label className="flex flex-col gap-1 text-xs font-medium mb-3">
              Message <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={3}
                placeholder="Any context for the recipient..."
                className="rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>

            {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  reset();
                }}
                disabled={isSubmitting}
                className="h-9 px-3 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-medium disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={isSubmitting}
                className="h-9 px-3 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
              >
                {isSubmitting ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
