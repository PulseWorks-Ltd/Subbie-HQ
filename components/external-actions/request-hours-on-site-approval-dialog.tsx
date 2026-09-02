"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ContactOption = { id: string; name: string; email: string | null; role: string | null };

const ONE_OFF_SENTINEL = "__one_off__";

// Sends an Hours on Site sheet for external approval by secure, no-login
// link — the same infrastructure as RequestPackageApprovalDialog (fixed
// type: "approve", auto-drafted message, review-before-send), not a new
// parallel approval mechanism. Replaces the old "email a static PDF"
// action: the recipient gets a link to view the sheet and Approve/Reject
// it, which — on Approve — locks the sheet and notifies its creator (see
// lib/external-action.ts's submitExternalActionResponse).
export function RequestHoursOnSiteApprovalDialog({
  projectId,
  sheetId,
  contacts
}: {
  projectId: string;
  sheetId: string;
  contacts: ContactOption[];
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [recipientSelection, setRecipientSelection] = useState(contacts[0]?.id ?? ONE_OFF_SENTINEL);
  const [oneOffEmail, setOneOffEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  const eligibleContacts = contacts.filter((contact) => contact.email);
  const isOneOff = recipientSelection === ONE_OFF_SENTINEL;

  async function fetchDraft() {
    setIsDrafting(true);
    setDraftError(null);
    const response = await fetch(`/api/projects/${projectId}/external-actions/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hoursOnSiteSheetId: sheetId, type: "approve" })
    });
    const body = await response.json().catch(() => null);
    setIsDrafting(false);
    if (!response.ok) {
      setDraftError(typeof body?.error === "string" ? body.error : "Could not draft a message.");
      return;
    }
    setMessage(body.messageBody ?? "");
  }

  useEffect(() => {
    if (!isOpen || message.trim()) return;
    void fetchDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function reset() {
    setRecipientSelection(contacts[0]?.id ?? ONE_OFF_SENTINEL);
    setOneOffEmail("");
    setMessage("");
    setDraftError(null);
    setError(null);
  }

  async function handleSend() {
    if (isOneOff && !oneOffEmail.trim()) {
      setError("Enter an email address.");
      return;
    }
    if (!message.trim()) {
      setError("Review and confirm the message before sending.");
      return;
    }
    setError(null);
    setIsSubmitting(true);

    const response = await fetch(`/api/projects/${projectId}/external-actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hoursOnSiteSheetId: sheetId,
        type: "approve",
        message: message.trim(),
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
    setSentMessage("Sent for approval.");
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="h-10 px-4 flex items-center justify-center rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 shrink-0"
      >
        Request Approval
      </button>
      {sentMessage && <span className="text-xs text-green-600 dark:text-green-400 ml-2">{sentMessage}</span>}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="relative w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 p-5 shadow-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-bold mb-1">Request Approval</h3>
            <p className="text-xs text-[#4c739a] dark:text-slate-400 mb-3">
              Sends this Hours on Site sheet by secure, no-login link for the Site Manager to review and approve.
              Approving locks the sheet and marks it ready for a variation claim.
            </p>

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

            <div className="flex flex-col gap-1 mb-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium">Message — review before sending</label>
                <button
                  type="button"
                  onClick={fetchDraft}
                  disabled={isDrafting}
                  className="text-[11px] font-bold text-primary hover:underline disabled:opacity-60"
                >
                  {isDrafting ? "Drafting..." : "Regenerate draft"}
                </button>
              </div>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={5}
                disabled={isDrafting}
                placeholder="Drafting..."
                className="rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
              />
              {draftError && <p className="text-xs text-red-600">{draftError}</p>}
            </div>

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
                disabled={isSubmitting || isDrafting || !message.trim()}
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
