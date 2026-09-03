"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PaymentClaim } from "@prisma/client";

function formatCurrency(amount: number | string | { toString(): string }) {
  return Number(amount).toLocaleString("en-NZ", { style: "currency", currency: "NZD" });
}
function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_LABELS: Record<string, string> = { draft: "Draft", issued: "Issued", responded: "Responded" };

function defaultNextPeriod(claims: PaymentClaim[]): { start: string; end: string } {
  const latest = claims[0];
  const start = latest ? new Date(latest.periodEnd) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  if (latest) start.setUTCDate(start.getUTCDate() + 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export function PaymentClaimsListView({ projectId, claims }: { projectId: string; claims: PaymentClaim[] }) {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const initial = defaultNextPeriod(claims);
  const [periodStart, setPeriodStart] = useState(initial.start);
  const [periodEnd, setPeriodEnd] = useState(initial.end);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const response = await fetch(`/api/projects/${projectId}/payment-claims`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodStart, periodEnd })
    });
    setIsSubmitting(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(typeof body?.error === "string" ? body.error : "Could not create the claim.");
      return;
    }
    const { claim } = await response.json();
    setIsDialogOpen(false);
    router.push(`/projects/${projectId}/payment-claims/${claim.id}`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Payment Claims</h2>
          <p className="text-sm text-[#4c739a] dark:text-slate-400">
            Monthly claims under the Construction Contracts Act, built from the Contract Schedule and approved Variations.
          </p>
        </div>
        <button
          onClick={() => setIsDialogOpen(true)}
          className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 shrink-0"
        >
          Create Claim
        </button>
      </div>

      <p className="text-xs text-[#4c739a] dark:text-slate-400">
        Before creating a claim, make sure the{" "}
        <Link href={`/projects/${projectId}/contract-schedule`} className="text-primary hover:underline">
          Contract Schedule
        </Link>{" "}
        reflects real progress up to this claim's period — the amount claimed for original contract works is computed from it.
      </p>

      {claims.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#cfdbe7] dark:border-slate-700 py-16">
          <p className="font-bold mb-1">No claims yet</p>
          <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-5">Create the first monthly claim for this project.</p>
          <button onClick={() => setIsDialogOpen(true)} className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90">
            Create Claim
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {claims.map((claim) => (
            <Link
              key={claim.id}
              href={`/projects/${projectId}/payment-claims/${claim.id}`}
              className="flex items-center justify-between rounded-xl border border-[#e7edf3] dark:border-slate-700 p-4 hover:border-primary/40"
            >
              <div>
                <p className="font-bold">Claim {claim.claimNumber}</p>
                <p className="text-xs text-[#4c739a] dark:text-slate-400">
                  {formatDate(claim.periodStart)} – {formatDate(claim.periodEnd)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold">{formatCurrency(claim.claimedAmount)}</p>
                <p className="text-xs text-[#4c739a] dark:text-slate-400">{STATUS_LABELS[claim.status] ?? claim.status}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="relative w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 p-6 shadow-lg">
            <h2 className="text-lg font-bold mb-1">Create claim</h2>
            <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-5">Pick the period this claim covers.</p>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-sm font-medium">
                Period start
                <input
                  type="date"
                  required
                  value={periodStart}
                  onChange={(event) => setPeriodStart(event.target.value)}
                  className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Period end
                <input
                  type="date"
                  required
                  value={periodEnd}
                  onChange={(event) => setPeriodEnd(event.target.value)}
                  className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm"
                />
              </label>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3 justify-end mt-2">
                <button type="button" onClick={() => setIsDialogOpen(false)} className="h-10 px-4 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-medium">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60">
                  {isSubmitting ? "Creating..." : "Create claim"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
