"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ContractItemValueBreakdown } from "@/lib/contract-schedule";

function formatCurrency(amount: number) {
  return amount.toLocaleString("en-NZ", { style: "currency", currency: "NZD" });
}
function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}
function round2(value: number) {
  return Math.round(value * 100) / 100;
}

type VariationRow = {
  id: string;
  reference: string;
  title: string;
  value: number;
  closed: boolean;
  thisClaimAmount: number;
  totalAllocatedAcrossAllClaims: number;
};

type ContactOption = { id: string; name: string; email: string | null; role: string | null };

type Recipient = { contactId?: string; email: string; label: string };

// Pre-Launch Feature 5 — recipient picking + AI draft + send, in one
// self-contained panel. Mirrors UpdateComposer's external-send flow (same
// draft-then-review-then-send shape, same "a saved contact's email is
// resolved server-side, never trusted from the client" rule) — the one
// real difference is a separate CC list, since claim submissions commonly
// copy a Quantity Surveyor alongside the Main Contractor's primary contact.
function SendClaimPanel({ projectId, claimId, contacts }: { projectId: string; claimId: string; contacts: ContactOption[] }) {
  const router = useRouter();
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
      const response = await fetch(`/api/projects/${projectId}/payment-claims/${claimId}/draft-email`, { method: "POST" });
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
      const response = await fetch(`/api/projects/${projectId}/payment-claims/${claimId}/send`, {
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
        setSendError(data.error || "Could not send this claim.");
        return;
      }
      if (data.sendError) {
        setSendError(`Claim PDF was generated, but the email failed to send: ${data.sendError} You can retry.`);
        return;
      }
      setSentMessage("Payment Claim sent and marked issued.");
      setDrafted(null);
      setTo([]);
      setCc([]);
      router.refresh();
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
          href={`/api/projects/${projectId}/payment-claims/${claimId}/pdf`}
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
              {isSending ? "Sending..." : "Send Payment Claim"}
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

export function PaymentClaimDetailView({
  projectId,
  claim,
  hasSchedule,
  originalSubcontractSum,
  scheduleBreakdown,
  scheduleClaimedToDate,
  scheduleThisClaim,
  retentionPercent,
  variations,
  contacts
}: {
  projectId: string;
  claim: {
    id: string;
    claimNumber: number;
    status: string;
    periodStart: string;
    periodEnd: string;
    referenceDate: string;
    statutoryWording: string;
    contractWorksAmount: number;
    otherAmount: number;
    claimedAmount: number;
  };
  hasSchedule: boolean;
  originalSubcontractSum: number;
  scheduleBreakdown: ContractItemValueBreakdown[];
  scheduleClaimedToDate: number;
  scheduleThisClaim: number;
  retentionPercent: number;
  variations: VariationRow[];
  contacts: ContactOption[];
}) {
  const router = useRouter();
  const [allocationInputs, setAllocationInputs] = useState<Record<string, string>>(
    Object.fromEntries(variations.map((v) => [v.id, v.thisClaimAmount ? String(v.thisClaimAmount) : ""]))
  );
  const [savingId, setSavingId] = useState<string | null>(null);

  const approvedVariationsTotal = variations.reduce((sum, v) => sum + v.value, 0);
  const variationsClaimedToDate = variations.reduce((sum, v) => sum + v.totalAllocatedAcrossAllClaims, 0);
  const variationsThisClaim = variations.reduce((sum, v) => sum + v.thisClaimAmount, 0);

  const revisedSubcontractSum = round2(originalSubcontractSum + approvedVariationsTotal);
  const grossClaimToDate = round2(scheduleClaimedToDate + variationsClaimedToDate + claim.otherAmount);
  const retention = round2(grossClaimToDate * (retentionPercent / 100));
  const netClaimToDate = round2(grossClaimToDate - retention);

  const thisClaimGross = round2(scheduleThisClaim + variationsThisClaim + claim.otherAmount);
  const thisClaimRetention = round2(thisClaimGross * (retentionPercent / 100));
  const thisClaimNet = round2(thisClaimGross - thisClaimRetention);
  const gst = round2(thisClaimNet * 0.15);
  const thisClaimGrossInclGst = round2(thisClaimNet + gst);

  async function saveAllocation(variationItemId: string) {
    setSavingId(variationItemId);
    const amount = Number(allocationInputs[variationItemId] || 0);
    await fetch(`/api/projects/${projectId}/payment-claims/${claim.id}/allocations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variationItemId, amount })
    });
    setSavingId(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/projects/${projectId}/payment-claims`} className="text-xs text-primary hover:underline">
            ← All claims
          </Link>
          <div className="flex items-center gap-2 mt-1">
            <h2 className="text-lg font-bold">Payment Claim {claim.claimNumber}</h2>
            <span
              className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${
                claim.status === "issued"
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
                  : claim.status === "responded"
                    ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              {claim.status}
            </span>
          </div>
          <p className="text-sm text-[#4c739a] dark:text-slate-400">
            {formatDate(claim.periodStart)} – {formatDate(claim.periodEnd)} · {claim.statutoryWording}
          </p>
        </div>
      </div>

      {!hasSchedule && (
        <p className="text-sm rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 p-3">
          No Contract Schedule exists for this project yet — the original contract works amount below is $0 until one is set up on
          the{" "}
          <Link href={`/projects/${projectId}/contract-schedule`} className="underline font-medium">
            Contract Schedule
          </Link>{" "}
          page.
        </p>
      )}

      <div className="rounded-xl border border-[#e7edf3] dark:border-slate-700 p-4">
        <h3 className="text-sm font-bold mb-3">Summary — this claim</h3>
        <dl className="flex flex-col gap-1 text-sm">
          <Row label="1. Original Subcontract Sum" value={formatCurrency(originalSubcontractSum)} />
          <Row label="2. Approved Variations" value={formatCurrency(approvedVariationsTotal)} />
          <Row label="3. Revised Subcontract Sum" value={formatCurrency(revisedSubcontractSum)} bold />
          <div className="h-2" />
          <Row label="4. Original contract works — this claim" value={formatCurrency(scheduleThisClaim)} />
          <Row label="5. Variations — this claim" value={formatCurrency(variationsThisClaim)} />
          {claim.otherAmount !== 0 && <Row label="6. Other" value={formatCurrency(claim.otherAmount)} />}
          <Row label="7. Gross amount — this claim" value={formatCurrency(thisClaimGross)} bold />
          <Row label={`8. Less retention (${retentionPercent}%)`} value={`(${formatCurrency(thisClaimRetention)})`} />
          <Row label="9. Net amount — this claim" value={formatCurrency(thisClaimNet)} bold />
          <Row label="10. Plus GST (15%)" value={formatCurrency(gst)} />
          <Row label="11. Gross amount for this claim (incl. GST)" value={formatCurrency(thisClaimGrossInclGst)} bold big />
        </dl>
        <p className="text-xs text-[#4c739a] dark:text-slate-400 mt-4">
          Cumulative to date: {formatCurrency(grossClaimToDate)} gross, {formatCurrency(retention)} retention held, {formatCurrency(netClaimToDate)} net.
        </p>
      </div>

      <div className="rounded-xl border border-[#e7edf3] dark:border-slate-700 p-4">
        <h3 className="text-sm font-bold mb-3">Original contract works — from the Contract Schedule</h3>
        {scheduleBreakdown.length === 0 ? (
          <p className="text-sm text-[#4c739a] dark:text-slate-400">No contract items to show.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[#4c739a] dark:text-slate-400 border-b border-[#e7edf3] dark:border-slate-700">
                  <th className="py-1.5 pr-2">Item</th>
                  <th className="py-1.5 pr-2">Component</th>
                  <th className="py-1.5 pr-2 text-right">Previous</th>
                  <th className="py-1.5 pr-2 text-right">This claim</th>
                  <th className="py-1.5 text-right">To date</th>
                </tr>
              </thead>
              <tbody>
                {scheduleBreakdown.map((item) =>
                  item.components.map((component, index) => (
                    <tr key={component.componentId} className="border-b border-[#e7edf3]/60 dark:border-slate-800">
                      <td className="py-1.5 pr-2">{index === 0 ? item.description : ""}</td>
                      <td className="py-1.5 pr-2">{component.label}</td>
                      <td className="py-1.5 pr-2 text-right">{formatCurrency(component.previousClaimedToDate)}</td>
                      <td className="py-1.5 pr-2 text-right font-medium">{formatCurrency(component.thisClaimAmount)}</td>
                      <td className="py-1.5 text-right">{formatCurrency(component.claimedToDate)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <SendClaimPanel projectId={projectId} claimId={claim.id} contacts={contacts} />

      <div className="rounded-xl border border-[#e7edf3] dark:border-slate-700 p-4">
        <h3 className="text-sm font-bold mb-3">Variations</h3>
        {variations.length === 0 ? (
          <p className="text-sm text-[#4c739a] dark:text-slate-400">No Variations exist on this project yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {variations.map((variation) => (
              <div key={variation.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e7edf3]/60 dark:border-slate-800 py-2 last:border-0">
                <div>
                  <p className="text-sm font-medium">
                    {variation.reference} — {variation.title}
                    {variation.closed && <span className="text-[#4c739a] dark:text-slate-400"> (closed)</span>}
                  </p>
                  <p className="text-xs text-[#4c739a] dark:text-slate-400">
                    Value {formatCurrency(variation.value)} · Claimed to date (excl. this claim){" "}
                    {formatCurrency(variation.totalAllocatedAcrossAllClaims - variation.thisClaimAmount)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={allocationInputs[variation.id] ?? ""}
                    onChange={(event) => setAllocationInputs((prev) => ({ ...prev, [variation.id]: event.target.value }))}
                    className="h-8 w-28 rounded-md border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs text-right"
                  />
                  <button
                    onClick={() => saveAllocation(variation.id)}
                    disabled={savingId === variation.id}
                    className="h-8 px-3 rounded-md bg-primary text-white text-xs font-bold hover:bg-primary/90 disabled:opacity-60"
                  >
                    {savingId === variation.id ? "Saving..." : "Set"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, bold, big }: { label: string; value: string; bold?: boolean; big?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className={bold ? "font-bold" : "text-[#4c739a] dark:text-slate-400"}>{label}</dt>
      <dd className={big ? "font-bold text-base" : bold ? "font-bold" : ""}>{value}</dd>
    </div>
  );
}
