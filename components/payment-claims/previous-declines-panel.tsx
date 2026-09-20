"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function formatCurrency(amount: number) {
  return amount.toLocaleString("en-NZ", { style: "currency", currency: "NZD" });
}

export type OpenDeclineLineView = {
  id: string;
  paymentClaimId: string;
  claimNumber: number;
  description: string;
  amount: number;
  reason: string;
  variationItemId: string | null;
  variationLabel: string | null;
};

function DeclineLineRow({ projectId, claimId, line }: { projectId: string; claimId: string; line: OpenDeclineLineView }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteAction, setNoteAction] = useState<"credit" | "evidence_provided" | "resolve_other" | null>(null);
  const [note, setNote] = useState("");

  async function patch(body: Record<string, unknown>) {
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/payment-claims/${line.paymentClaimId}/reconciliation/decline-lines/${line.id}`,
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not resolve this decline.");
        return;
      }
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border border-[#e7edf3] dark:border-slate-700 p-3 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm">
            <span className="font-bold">{formatCurrency(line.amount)}</span> — {line.description}
            <span className="text-[#4c739a] dark:text-slate-400"> (Claim {line.claimNumber})</span>
          </p>
          <p className="text-xs text-[#4c739a] dark:text-slate-400">{line.reason}</p>
          {line.variationItemId && (
            <Link href={`/projects/${projectId}/variations/${line.variationItemId}`} className="text-xs text-primary hover:underline">
              {line.variationLabel}
            </Link>
          )}
        </div>
      </div>

      {noteAction && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Optional note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="h-8 flex-1 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs"
          />
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => patch({ action: noteAction, note: note || null })}
            className="h-8 px-3 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 disabled:opacity-60"
          >
            Confirm
          </button>
          <button type="button" onClick={() => setNoteAction(null)} className="text-xs text-[#4c739a] dark:text-slate-400 underline">
            Cancel
          </button>
        </div>
      )}

      {!noteAction && (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => patch({ action: "carry_forward", targetClaimId: claimId })}
            className="text-xs font-bold text-primary hover:underline disabled:opacity-60"
          >
            Carry forward into this claim
          </button>
          <button type="button" onClick={() => setNoteAction("evidence_provided")} className="text-xs font-bold text-[#4c739a] dark:text-slate-400 hover:underline">
            Evidence provided
          </button>
          <button type="button" onClick={() => setNoteAction("credit")} className="text-xs font-bold text-[#4c739a] dark:text-slate-400 hover:underline">
            Apply as credit
          </button>
          <button type="button" onClick={() => setNoteAction("resolve_other")} className="text-xs font-bold text-[#4c739a] dark:text-slate-400 hover:underline">
            Other resolution
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

// Only ever rendered on a DRAFT claim (see the claim detail page) — this
// is the concrete "previous claim: $100,000 / previously certified:
// $87,000 / $13,000 declined... then the user can decide" flow the user
// asked for (Task 4), surfaced at the exact point it's actionable: while
// preparing the next claim, not retroactively on one already sent.
export function PreviousDeclinesPanel({
  projectId,
  claimId,
  lines
}: {
  projectId: string;
  claimId: string;
  lines: OpenDeclineLineView[];
}) {
  if (lines.length === 0) return null;

  const total = lines.reduce((sum, line) => sum + line.amount, 0);

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/10 p-4">
      <h3 className="text-sm font-bold text-amber-900 dark:text-amber-300 mb-1">Previous Certification Position</h3>
      <p className="text-xs text-amber-800 dark:text-amber-400 mb-3">
        {formatCurrency(total)} across {lines.length} decline{lines.length === 1 ? "" : "s"} from earlier claims hasn&apos;t been
        resolved yet. Decide whether to carry each forward into this claim, or resolve it another way.
      </p>
      <div className="flex flex-col gap-2">
        {lines.map((line) => (
          <DeclineLineRow key={line.id} projectId={projectId} claimId={claimId} line={line} />
        ))}
      </div>
    </div>
  );
}
