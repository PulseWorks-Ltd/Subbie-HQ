"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SiteInstructionMatch = {
  id: string;
  reference: string;
  title: string;
  createdAt: string;
  closedAt: string | null;
  lastActivityAt: string;
};
type LookupResult =
  | { kind: "none" }
  | { kind: "exact"; match: SiteInstructionMatch }
  | { kind: "ambiguous"; candidates: SiteInstructionMatch[] };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

// The shared duplicate-detection prompt ("SI-241 — CLOSED... is this the
// correct SI for this work?") — surfaced under the Reference field while
// creating a new Site Instruction or Variation. An exact, normalised match
// (SI-241/SI 241/SI241/si-241/SI-0241 all count as the same reference) is
// automatic; anything looser (e.g. a bare "241") is shown as a list of
// possible matches the user must explicitly pick from — never auto-linked.
// Reactivating here never creates a new row: it reactivates the existing
// VariationItem and sends the user straight to it, so the create form
// never ends up producing a duplicate for a reference that already exists.
export function ReferenceDuplicateCheck({
  projectId,
  reference,
  onDismiss
}: {
  projectId: string;
  reference: string;
  onDismiss: () => void;
}) {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [isReactivating, setIsReactivating] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  async function check() {
    if (!reference.trim()) return;
    setIsChecking(true);
    setDismissed(false);
    const response = await fetch(`/api/projects/${projectId}/variation-items/resolve-reference?reference=${encodeURIComponent(reference)}`);
    const body = await response.json().catch(() => null);
    setIsChecking(false);
    setResult(response.ok ? body.result : null);
  }

  async function reactivateAndOpen(matchId: string) {
    setIsReactivating(matchId);
    await fetch(`/api/projects/${projectId}/variation-items/${matchId}/reactivate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: "Reactivated: new record linked during creation" })
    });
    setIsReactivating(null);
    onDismiss();
    router.push(`/projects/${projectId}/variations/${matchId}`);
    router.refresh();
  }

  if (isChecking) {
    return <p className="text-xs text-[#4c739a] dark:text-slate-400">Checking for an existing match...</p>;
  }

  if (!result || result.kind === "none" || dismissed) {
    return (
      <button
        type="button"
        onClick={check}
        className="text-xs font-medium text-primary hover:underline self-start"
      >
        Check if this reference already exists
      </button>
    );
  }

  if (result.kind === "exact") {
    const { match } = result;
    if (!match.closedAt) {
      return (
        <div className="rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-[#f6f7f8] dark:bg-slate-800/60 p-3 text-xs">
          <p className="text-[#4c739a] dark:text-slate-400">
            <strong className="text-[#0d141b] dark:text-slate-50">{match.reference}</strong> already exists and is active.
          </p>
          <button
            type="button"
            onClick={() => router.push(`/projects/${projectId}/variations/${match.id}`)}
            className="mt-2 font-bold text-primary hover:underline"
          >
            Go to {match.reference} instead
          </button>
        </div>
      );
    }
    return (
      <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/20 p-3 text-xs">
        <p className="font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400 mb-1">
          {match.reference} — Closed
        </p>
        <p className="text-[#0d141b] dark:text-slate-50 mb-1">{match.title}</p>
        <p className="text-[#4c739a] dark:text-slate-400 mb-2">
          Created {formatDate(match.createdAt)} · Closed {formatDate(match.closedAt)} · Last activity{" "}
          {formatDate(match.lastActivityAt)}
        </p>
        <p className="text-[#0d141b] dark:text-slate-50 mb-2">
          This SI was previously closed. Is this the correct SI for this work?
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={() => setDismissed(true)} className="font-bold text-[#4c739a] dark:text-slate-400 hover:underline">
            No
          </button>
          <button
            type="button"
            onClick={() => reactivateAndOpen(match.id)}
            disabled={isReactivating === match.id}
            className="font-bold text-primary hover:underline disabled:opacity-60"
          >
            {isReactivating === match.id ? "Reactivating..." : "Yes — Reactivate SI"}
          </button>
        </div>
      </div>
    );
  }

  // ambiguous
  return (
    <div className="rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-[#f6f7f8] dark:bg-slate-800/60 p-3 text-xs">
      <p className="text-[#0d141b] dark:text-slate-50 mb-2">
        We found possible matches for &ldquo;{reference}&rdquo; — did you mean one of these?
      </p>
      <div className="flex flex-col gap-2">
        {result.candidates.map((candidate) => (
          <div key={candidate.id} className="flex items-center justify-between gap-2 rounded border border-[#e7edf3] dark:border-slate-700 px-2 py-1.5">
            <span>
              <strong>{candidate.reference}</strong> — {candidate.title}
              {candidate.closedAt && <span className="ml-1 text-amber-700 dark:text-amber-400">(Closed {formatDate(candidate.closedAt)})</span>}
            </span>
            {candidate.closedAt ? (
              <button
                type="button"
                onClick={() => reactivateAndOpen(candidate.id)}
                disabled={isReactivating === candidate.id}
                className="font-bold text-primary hover:underline shrink-0 disabled:opacity-60"
              >
                {isReactivating === candidate.id ? "..." : "Reactivate & open"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => router.push(`/projects/${projectId}/variations/${candidate.id}`)}
                className="font-bold text-primary hover:underline shrink-0"
              >
                Open
              </button>
            )}
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setDismissed(true)} className="mt-2 font-medium text-[#4c739a] dark:text-slate-400 hover:underline">
        None of these — continue creating new
      </button>
    </div>
  );
}
