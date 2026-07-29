"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { MainContractorContact } from "@prisma/client";
import { CONTRACTS_MANAGER_ROLE } from "@/lib/main-contractor-roles";
import { RESPONSE_LETTER_DISCLAIMER } from "@/lib/legal-disclaimer";

export function ResponseLetterDrafting({
  projectId,
  documentId,
  contractReviewId,
  selectedIds,
  selectableCount,
  onClear
}: {
  projectId: string;
  documentId: string;
  contractReviewId: string;
  selectedIds: string[];
  selectableCount: number;
  onClear: () => void;
}) {
  const [isPickingContact, setIsPickingContact] = useState(false);
  const [contacts, setContacts] = useState<MainContractorContact[]>([]);
  const [contactId, setContactId] = useState("");
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftBody, setDraftBody] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isPickingContact) return;
    setIsLoadingContacts(true);
    fetch(`/api/projects/${projectId}/main-contractor`)
      .then((response) => response.json())
      .then((body) => {
        const activeIds: string[] = body.activeContactIds ?? [];
        const allContacts: MainContractorContact[] = body.mainContractor?.contacts ?? [];
        const activeContacts = allContacts.filter((c) => activeIds.includes(c.id));
        setContacts(activeContacts.length > 0 ? activeContacts : allContacts);
        const defaultContact =
          activeContacts.find((c) => c.role === CONTRACTS_MANAGER_ROLE) ??
          allContacts.find((c) => c.role === CONTRACTS_MANAGER_ROLE) ??
          activeContacts[0] ??
          allContacts[0];
        setContactId(defaultContact?.id ?? "");
        setIsLoadingContacts(false);
      });
  }, [isPickingContact, projectId]);

  if (selectableCount === 0) return null;

  async function handleDraft() {
    setError(null);
    if (!contactId) {
      setError("Select a contact to address the letter to.");
      return;
    }
    setIsDrafting(true);
    const response = await fetch(
      `/api/projects/${projectId}/contract-documents/${documentId}/review/draft-letter`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractReviewId, deviationIds: selectedIds, contactId })
      }
    );
    const body = await response.json().catch(() => null);
    setIsDrafting(false);

    if (!response.ok) {
      setError(typeof body?.error === "string" ? body.error : "Could not draft a response letter.");
      return;
    }

    setDraftBody(body.correspondence.bodyText);
  }

  async function handleCopy() {
    if (!draftBody) return;
    await navigator.clipboard.writeText(draftBody);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (draftBody) {
    return (
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold">Response letter drafted</h4>
          <Link href={`/projects/${projectId}/correspondence`} className="text-xs font-bold text-primary hover:underline">
            View in Correspondence
          </Link>
        </div>
        <textarea
          readOnly
          value={draftBody}
          rows={14}
          className="w-full rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm leading-relaxed"
        />
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopy}
            className="h-9 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            onClick={() => {
              setDraftBody(null);
              onClear();
            }}
            className="text-sm font-medium text-[#4c739a] dark:text-slate-400 hover:underline"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#e7edf3] dark:border-slate-800 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">
          {selectedIds.length} clause{selectedIds.length === 1 ? "" : "s"} selected
        </p>
        {!isPickingContact && (
          <button
            onClick={() => setIsPickingContact(true)}
            disabled={selectedIds.length === 0}
            className="h-9 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Draft response
          </button>
        )}
      </div>

      {isPickingContact && (
        <div className="flex flex-col gap-3">
          {isLoadingContacts ? (
            <p className="text-sm text-[#4c739a] dark:text-slate-400">Loading contacts...</p>
          ) : contacts.length === 0 ? (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              No contacts set up for this Main Contractor yet — add one from{" "}
              <Link href="/main-contractors" className="underline">
                Main Contractors
              </Link>{" "}
              first.
            </p>
          ) : (
            <label className="flex flex-col gap-1 text-sm font-medium">
              Address to
              <select
                value={contactId}
                onChange={(event) => setContactId(event.target.value)}
                className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.name}
                    {contact.role ? ` (${contact.role})` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}

          <p className="text-xs text-[#4c739a] dark:text-slate-400 leading-relaxed">{RESPONSE_LETTER_DISCLAIMER}</p>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button
              onClick={() => setIsPickingContact(false)}
              className="h-9 px-4 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleDraft}
              disabled={isDrafting || contacts.length === 0}
              className="h-9 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
            >
              {isDrafting ? "Drafting..." : "Generate letter"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
