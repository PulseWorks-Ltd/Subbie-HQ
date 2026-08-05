"use client";

import { useState } from "react";

type ContactOption = { id: string; name: string; email: string | null; role: string | null };
type AttachmentOption = { id: string; fileName: string; authorLabel: string };
type Recipient = { contactId?: string; email: string; label: string };

// Recipient picker + AI-draft-then-edit-then-send flow for generating an
// outbound summary email from an EXISTING update thread — mirrors the same
// recipient picker and "draft with AI, review before sending" pattern
// already used in update-composer.tsx's External Update flow, just against
// a whole thread's worth of content instead of one rough note being typed.
export function GenerateOutboundEmailPanel({
  projectId,
  updateId,
  contacts,
  attachmentOptions,
  onCancel,
  onSent
}: {
  projectId: string;
  updateId: string;
  contacts: ContactOption[];
  attachmentOptions: AttachmentOption[];
  onCancel: () => void;
  onSent: () => void;
}) {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [oneOffEmail, setOneOffEmail] = useState("");
  const [selectedAttachmentIds, setSelectedAttachmentIds] = useState<string[]>([]);
  const [drafted, setDrafted] = useState<{ subject: string; body: string } | null>(null);
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const eligibleContacts = contacts.filter((contact) => contact.email);

  function toggleContactRecipient(contact: ContactOption) {
    setRecipients((current) => {
      const exists = current.some((r) => r.contactId === contact.id);
      if (exists) return current.filter((r) => r.contactId !== contact.id);
      return [...current, { contactId: contact.id, email: contact.email!, label: contact.name }];
    });
  }

  function addOneOffEmail() {
    const email = oneOffEmail.trim();
    if (!email || !email.includes("@")) return;
    if (recipients.some((r) => r.email.toLowerCase() === email.toLowerCase())) {
      setOneOffEmail("");
      return;
    }
    setRecipients((current) => [...current, { email, label: email }]);
    setOneOffEmail("");
  }

  function removeRecipient(email: string) {
    setRecipients((current) => current.filter((r) => r.email !== email));
  }

  function toggleAttachment(id: string) {
    setSelectedAttachmentIds((current) => (current.includes(id) ? current.filter((attachmentId) => attachmentId !== id) : [...current, id]));
  }

  async function handleDraft() {
    setIsDrafting(true);
    setDraftError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/updates/${updateId}/draft-summary-email`, {
        method: "POST"
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not draft an email.");
      }
      setDrafted(data.drafted);
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : "Could not draft an email.");
    } finally {
      setIsDrafting(false);
    }
  }

  async function handleSend() {
    if (!drafted || recipients.length === 0) return;
    setIsSending(true);
    setSendError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/updates/${updateId}/send-summary-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: drafted.subject,
          body: drafted.body,
          recipients: recipients.map((r) => ({ contactId: r.contactId, email: r.email })),
          attachmentIds: selectedAttachmentIds
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Could not send this email.");
      }
      onSent();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Could not send this email.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[#e7edf3] dark:border-slate-700 p-3">
      <div>
        <p className="text-xs font-bold mb-1">Recipients</p>
        {eligibleContacts.length > 0 && (
          <div className="flex flex-col gap-1 mb-2">
            {eligibleContacts.map((contact) => (
              <label key={contact.id} className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={recipients.some((r) => r.contactId === contact.id)}
                  onChange={() => toggleContactRecipient(contact)}
                />
                {contact.name} {contact.role ? `(${contact.role})` : ""} — {contact.email}
              </label>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            type="email"
            value={oneOffEmail}
            onChange={(event) => setOneOffEmail(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addOneOffEmail();
              }
            }}
            placeholder="Add a one-off email address"
            className="h-8 flex-1 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            type="button"
            onClick={addOneOffEmail}
            className="h-8 px-2 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-xs font-medium"
          >
            Add
          </button>
        </div>
        {recipients.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {recipients.map((recipient) => (
              <span
                key={recipient.email}
                className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[11px] px-2 py-1"
              >
                {recipient.label}
                <button type="button" onClick={() => removeRecipient(recipient.email)} className="font-bold">
                  &times;
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {attachmentOptions.length > 0 && (
        <div>
          <p className="text-xs font-bold mb-1">Include attachments</p>
          <div className="flex flex-col gap-1">
            {attachmentOptions.map((attachment) => (
              <label key={attachment.id} className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={selectedAttachmentIds.includes(attachment.id)}
                  onChange={() => toggleAttachment(attachment.id)}
                />
                {attachment.fileName} <span className="text-[#4c739a] dark:text-slate-400">— {attachment.authorLabel}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {!drafted ? (
        <button
          type="button"
          onClick={handleDraft}
          disabled={isDrafting}
          className="self-start h-9 px-3 rounded-lg border border-primary text-primary text-xs font-bold disabled:opacity-60"
        >
          {isDrafting ? "Drafting..." : "Draft email with AI"}
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold">Review before sending</p>
          <input
            value={drafted.subject}
            onChange={(event) => setDrafted({ ...drafted, subject: event.target.value })}
            className="h-8 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <textarea
            value={drafted.body}
            onChange={(event) => setDrafted({ ...drafted, body: event.target.value })}
            rows={8}
            className="rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button type="button" onClick={() => setDrafted(null)} className="self-start text-xs text-[#4c739a] dark:text-slate-400 underline">
            Redo draft
          </button>
        </div>
      )}
      {draftError && <p className="text-xs text-red-600 dark:text-red-400">{draftError}</p>}
      {sendError && <p className="text-xs text-red-600 dark:text-red-400">{sendError}</p>}

      <div className="flex gap-2 justify-end pt-2 border-t border-[#e7edf3] dark:border-slate-800">
        <button
          type="button"
          onClick={onCancel}
          className="h-8 px-3 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-xs font-medium"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSend}
          disabled={isSending || !drafted || recipients.length === 0}
          className="h-8 px-3 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 disabled:opacity-60"
        >
          {isSending ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
}
