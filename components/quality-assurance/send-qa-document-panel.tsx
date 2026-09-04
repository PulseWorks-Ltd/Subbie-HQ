"use client";

import { useState } from "react";

type ContactOption = { id: string; name: string; email: string | null; role: string | null };
type Recipient = { contactId?: string; email: string; label: string };

// "Generate QA Document" — recipient picking + AI draft + send, in one
// self-contained panel. Modelled directly on payment-claim-detail-view.tsx's
// own SendClaimPanel (same draft-then-review-then-send shape, same "a
// saved contact's email is resolved server-side, never trusted from the
// client" rule, separate To/CC lists) — the one difference: the PDF here
// is a fixed, already-generated snapshot, so there's no "regenerate fresh"
// step, just a stored-file download link.
export function SendQaDocumentPanel({ projectId, qaDocumentId, contacts }: { projectId: string; qaDocumentId: string; contacts: ContactOption[] }) {
  const eligibleContacts = contacts.filter((c) => c.email);
  const [to, setTo] = useState<Recipient[]>([]);
  const [cc, setCc] = useState<Recipient[]>([]);
  const [oneOffTo, setOneOffTo] = useState("");
  const [oneOffCc, setOneOffCc] = useState("");
  const [drafted, setDrafted] = useState<{ subject: string; body: string } | null>(null);
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  function toggleContact(list: "to" | "cc", contact: ContactOption) {
    const setter = list === "to" ? setTo : setCc;
    setter((current) => {
      const exists = current.some((r) => r.contactId === contact.id);
      if (exists) return current.filter((r) => r.contactId !== contact.id);
      return [...current, { contactId: contact.id, email: contact.email!, label: contact.name }];
    });
  }

  function addOneOff(list: "to" | "cc") {
    const value = (list === "to" ? oneOffTo : oneOffCc).trim();
    if (!value || !value.includes("@")) return;
    const setter = list === "to" ? setTo : setCc;
    setter((current) => (current.some((r) => r.email.toLowerCase() === value.toLowerCase()) ? current : [...current, { email: value, label: value }]));
    (list === "to" ? setOneOffTo : setOneOffCc)("");
  }

  function removeRecipient(list: "to" | "cc", email: string) {
    (list === "to" ? setTo : setCc)((current) => current.filter((r) => r.email !== email));
  }

  async function handleDraft() {
    setIsDrafting(true);
    setDraftError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/qa-documents/${qaDocumentId}/draft-email`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not draft an email.");
      setDrafted(data.drafted);
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : "Could not draft an email.");
    } finally {
      setIsDrafting(false);
    }
  }

  async function handleSend() {
    if (!drafted || to.length === 0) return;
    setIsSending(true);
    setSendError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/qa-documents/${qaDocumentId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: to.map((r) => ({ contactId: r.contactId, email: r.email })),
          cc: cc.map((r) => ({ contactId: r.contactId, email: r.email })),
          subject: drafted.subject,
          body: drafted.body
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSendError(data.error || "Could not send this document.");
        return;
      }
      if (data.sendError) {
        setSendError(`Could not send the email: ${data.sendError} You can retry.`);
        return;
      }
      setSentMessage("QA Document sent.");
      setDrafted(null);
      setTo([]);
      setCc([]);
    } finally {
      setIsSending(false);
    }
  }

  function recipientList(list: "to" | "cc", recipients: Recipient[]) {
    return (
      recipients.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {recipients.map((r) => (
            <span key={r.email} className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[11px] px-2 py-1">
              {r.label}
              <button type="button" onClick={() => removeRecipient(list, r.email)} className="font-bold">&times;</button>
            </span>
          ))}
        </div>
      )
    );
  }

  return (
    <div className="rounded-xl border border-[#e7edf3] dark:border-slate-700 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-bold">Send to client</h3>
        <a
          href={`/api/projects/${projectId}/qa-documents/${qaDocumentId}/file`}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-bold text-primary hover:underline"
        >
          Preview / Download PDF
        </a>
      </div>

      <div>
        <p className="text-xs font-bold mb-1">To</p>
        {eligibleContacts.length > 0 && (
          <div className="flex flex-col gap-1 mb-2">
            {eligibleContacts.map((contact) => (
              <label key={contact.id} className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={to.some((r) => r.contactId === contact.id)} onChange={() => toggleContact("to", contact)} />
                {contact.name} {contact.role ? `(${contact.role})` : ""} — {contact.email}
              </label>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            type="email"
            value={oneOffTo}
            onChange={(event) => setOneOffTo(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addOneOff("to"); } }}
            placeholder="Add a one-off email address"
            className="h-8 flex-1 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button type="button" onClick={() => addOneOff("to")} className="h-8 px-2 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-xs font-medium">
            Add
          </button>
        </div>
        {recipientList("to", to)}
      </div>

      <div>
        <p className="text-xs font-bold mb-1">CC (optional)</p>
        {eligibleContacts.length > 0 && (
          <div className="flex flex-col gap-1 mb-2">
            {eligibleContacts.map((contact) => (
              <label key={contact.id} className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={cc.some((r) => r.contactId === contact.id)} onChange={() => toggleContact("cc", contact)} />
                {contact.name} {contact.role ? `(${contact.role})` : ""} — {contact.email}
              </label>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            type="email"
            value={oneOffCc}
            onChange={(event) => setOneOffCc(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addOneOff("cc"); } }}
            placeholder="Add a one-off email address"
            className="h-8 flex-1 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button type="button" onClick={() => addOneOff("cc")} className="h-8 px-2 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-xs font-medium">
            Add
          </button>
        </div>
        {recipientList("cc", cc)}
      </div>

      {!drafted ? (
        <button
          type="button"
          onClick={handleDraft}
          disabled={isDrafting || to.length === 0}
          className="h-9 self-start px-4 rounded-lg border border-primary text-primary text-xs font-bold disabled:opacity-60"
        >
          {isDrafting ? "Drafting..." : "Draft covering email with AI"}
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold">Review before sending — the PDF is attached automatically</p>
          <input
            value={drafted.subject}
            onChange={(event) => setDrafted({ ...drafted, subject: event.target.value })}
            className="h-8 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <textarea
            value={drafted.body}
            onChange={(event) => setDrafted({ ...drafted, body: event.target.value })}
            rows={6}
            className="rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setDrafted(null)} className="text-xs text-[#4c739a] dark:text-slate-400 underline">
              Redo draft
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={isSending || to.length === 0}
              className="h-9 px-4 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 disabled:opacity-60"
            >
              {isSending ? "Sending..." : "Send QA Document"}
            </button>
          </div>
        </div>
      )}

      {draftError && <p className="text-xs text-red-600 dark:text-red-400">{draftError}</p>}
      {sendError && <p className="text-xs text-red-600 dark:text-red-400">{sendError}</p>}
      {sentMessage && <p className="text-xs text-green-600 dark:text-green-400">{sentMessage}</p>}
    </div>
  );
}
