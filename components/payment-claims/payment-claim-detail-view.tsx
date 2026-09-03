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

export function PaymentClaimDetailView({
  projectId,
  claim,
  hasSchedule,
  originalSubcontractSum,
  scheduleBreakdown,
  scheduleClaimedToDate,
  scheduleThisClaim,
  retentionPercent,
  variations
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
          <h2 className="text-lg font-bold mt-1">Payment Claim {claim.claimNumber}</h2>
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
