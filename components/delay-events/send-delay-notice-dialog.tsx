"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ContactOption = { id: string; name: string; email: string | null; role: string | null };

const ONE_OFF_SENTINEL = "__one_off__";

// A dedicated, simpler sibling of RequestActionDialog — the target and
// action type are both fixed here (this delay event, type: approve, asking
// for a specific number of EOT days), so there's no action-type selector;
// the drafted message auto-fetches on open, same "never overwrite text
// the user's already started editing" rule as the generic dialog.
export function SendDelayNoticeDialog({
  projectId,
  delayEventId,
  contacts,
  open,
  onClose
}: {
  projectId: string;
  delayEventId: string;
  contacts: ContactOption[];
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const eligibleContacts = contacts.filter((contact) => contact.email);
  const [recipientSelection, setRecipientSelection] = useState(eligibleContacts[0]?.id ?? ONE_OFF_SENTINEL);
  const [oneOffEmail, setOneOffEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOneOff = recipientSelection === ONE_OFF_SENTINEL;

  async function fetchDraft() {
    setIsDrafting(true);
    setDraftError(null);
    const response = await fetch(`/api/projects/${projectId}/delay-events/${delayEventId}/draft-notice`, { method: "POST" });
    const body = await response.json().catch(() => null);
    setIsDrafting(false);
    if (!response.ok) {
      setDraftError(typeof body?.error === "string" ? body.error : "Could not draft a message.");
      return;
    }
    setMessage(body.drafted?.messageBody ?? "");
  }

  useEffect(() => {
    if (!open || message.trim()) return;
    void fetchDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  async function handleSend() {
    if (isOneOff && !oneOffEmail.trim()) {
      setError("Enter an email address.");
      return;
    }
    if (!message.trim()) {
      setError("Review and confirm the notice message before sending.");
      return;
    }
    setError(null);
    setIsSubmitting(true);

    const response = await fetch(`/api/projects/${projectId}/external-actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        delayEventId,
        type: "approve",
        message: message.trim(),
        contactId: isOneOff ? undefined : recipientSelection,
        email: isOneOff ? oneOffEmail.trim() : undefined
      })
    });

    setIsSubmitting(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(typeof body?.error === "string" ? body.error : "Could not send this notice.");
      return;
    }

    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="relative w-full max-w-md rounded-xl bg-white dark:bg-slate-900 p-6 shadow-lg max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 rounded-lg p-1 text-[#4c739a] hover:bg-[#e7edf3] dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>
        <h3 className="text-lg font-bold mb-1">Send delay/EOT notice</h3>
        <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-4">
          Sends a secure, no-login link asking the Main Contractor/Contract Administrator to review and confirm the Extension of Time.
        </p>

        <label className="flex flex-col gap-1 text-sm font-medium mb-3">
          Recipient
          <select
            value={recipientSelection}
            onChange={(event) => setRecipientSelection(event.target.value)}
            className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
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
          <label className="flex flex-col gap-1 text-sm font-medium mb-3">
            Email address
            <input
              type="email"
              required
              value={oneOffEmail}
              onChange={(event) => setOneOffEmail(event.target.value)}
              className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
        )}

        <label className="flex flex-col gap-1 text-sm font-medium mb-1">
          Notice message
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={6}
            className="rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>
        <button
          type="button"
          onClick={fetchDraft}
          disabled={isDrafting}
          className="self-start text-xs font-medium text-primary hover:underline mb-3 disabled:opacity-60"
        >
          {isDrafting ? "Drafting..." : "Regenerate draft"}
        </button>
        {draftError && <p className="text-xs text-red-600 mb-3">{draftError}</p>}

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <div className="flex gap-3 justify-end mt-2">
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-medium">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={isSubmitting}
            className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
          >
            {isSubmitting ? "Sending..." : "Send notice"}
          </button>
        </div>
      </div>
    </div>
  );
}
