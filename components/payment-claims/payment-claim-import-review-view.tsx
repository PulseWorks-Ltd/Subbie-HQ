"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function formatCurrency(amount: number | null) {
  return amount == null ? "—" : amount.toLocaleString("en-NZ", { style: "currency", currency: "NZD" });
}
function formatDate(date: string | null) {
  return date ? new Date(date).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

const MATCH_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  matched: { label: "MATCHED", color: "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300" },
  likely_match: { label: "LIKELY MATCH", color: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300" },
  new: { label: "NEW", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  conflict: { label: "CONFLICT", color: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300" },
  unresolved: { label: "UNRESOLVED", color: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300" },
  ignored: { label: "IGNORED", color: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500" }
};

type ImportItem = {
  id: string;
  reference: string | null;
  description: string;
  contractValue: number | null;
  revisedValue: number | null;
  claimedPercentToDate: number | null;
  claimedAmountToDate: number | null;
  currentPeriodAmount: number | null;
  matchStatus: string;
  matchedContractItemId: string | null;
  matchReason: string | null;
  conflictNote: string | null;
  userAction: string;
};

type ImportVariation = {
  id: string;
  reference: string | null;
  description: string;
  submittedValue: number | null;
  approvedValue: number | null;
  claimedPercentToDate: number | null;
  claimedAmountToDate: number | null;
  currentPeriodAmount: number | null;
  approvalStatusRaw: string | null;
  matchStatus: string;
  matchedVariationItemId: string | null;
  matchReason: string | null;
  conflictNote: string | null;
  existingRecordClosed: boolean;
  userAction: string;
};

type ImportRecord = {
  id: string;
  status: string;
  fileName: string;
  aiConfidence: number | null;
  aiNotes: string | null;
  externalClaimReference: string | null;
  claimDate: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  projectNameOnDocument: string | null;
  projectReferenceOnDocument: string | null;
  contractReferenceOnDocument: string | null;
  originalContractSum: number | null;
  approvedVariationsTotal: number | null;
  revisedContractSum: number | null;
  pendingVariationsTotal: number | null;
  grossClaimToDate: number | null;
  retentionPercentStated: number | null;
  retentionToDateStated: number | null;
  netClaimToDate: number | null;
  previousClaimsTotal: number | null;
  currentClaimAmount: number | null;
  baselineDate: string | null;
  arithmeticWarning: string | null;
  resultingPaymentClaimId: string | null;
  items: ImportItem[];
  variations: ImportVariation[];
};

function effectiveItemAction(item: ImportItem): string {
  if (item.userAction !== "pending") return item.userAction;
  if (item.matchStatus === "matched") return "accept_match";
  if (item.matchStatus === "new") return "create_new";
  return "ignore";
}
function effectiveVariationAction(v: ImportVariation): string {
  if (v.userAction !== "pending") return v.userAction;
  if (v.matchStatus === "matched" && !v.existingRecordClosed) return "match_existing";
  if (v.matchStatus === "new") return "create_new";
  return "ignore";
}

const ITEM_ACTION_LABELS: Record<string, string> = {
  pending: "Use suggestion",
  accept_match: "Match to existing item",
  create_new: "Create new item",
  ignore: "Don't import this item"
};
const VARIATION_ACTION_LABELS: Record<string, string> = {
  pending: "Use suggestion",
  match_existing: "Match to existing record",
  create_new: "Create new record",
  update_existing: "Match & update value",
  reactivate_and_update: "Reactivate & update",
  ignore: "Don't import this item"
};

function StatusBadge({ status }: { status: string }) {
  const info = MATCH_STATUS_LABELS[status] ?? { label: status.toUpperCase(), color: "bg-slate-100 text-slate-600" };
  return <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 ${info.color}`}>{info.label}</span>;
}

function ItemRow({
  item,
  projectId,
  importId,
  candidates,
  onChanged
}: {
  item: ImportItem;
  projectId: string;
  importId: string;
  candidates: { id: string; description: string }[];
  onChanged: () => void;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const action = effectiveItemAction(item);
  const needsCandidate = action === "accept_match";

  async function save(userAction: string, matchedContractItemId?: string | null) {
    setIsSaving(true);
    await fetch(`/api/projects/${projectId}/payment-claim-imports/${importId}/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userAction, ...(matchedContractItemId !== undefined ? { matchedContractItemId } : {}) })
    });
    setIsSaving(false);
    onChanged();
  }

  return (
    <tr className="border-b border-[#e7edf3] dark:border-slate-800 align-top">
      <td className="py-2 pr-3">
        <p className="font-medium">{item.reference ?? "—"}</p>
      </td>
      <td className="py-2 pr-3">
        <p>{item.description}</p>
        {item.conflictNote && <p className="text-[11px] text-red-600 dark:text-red-400 mt-1">{item.conflictNote}</p>}
        {!item.conflictNote && item.matchReason && <p className="text-[11px] text-[#4c739a] dark:text-slate-400 mt-1">{item.matchReason}</p>}
      </td>
      <td className="py-2 pr-3 text-right">{formatCurrency(item.contractValue)}</td>
      <td className="py-2 pr-3 text-right">{item.claimedPercentToDate != null ? `${item.claimedPercentToDate}%` : "—"}</td>
      <td className="py-2 pr-3">
        <StatusBadge status={item.matchStatus} />
      </td>
      <td className="py-2">
        <div className="flex flex-col gap-1 min-w-[11rem]">
          <select
            value={action}
            disabled={isSaving}
            onChange={(event) => save(event.target.value)}
            className="h-8 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-1 text-xs"
          >
            {Object.entries(ITEM_ACTION_LABELS)
              .filter(([value]) => value !== "pending")
              .map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
          </select>
          {needsCandidate && (
            <select
              value={item.matchedContractItemId ?? ""}
              disabled={isSaving}
              onChange={(event) => save("accept_match", event.target.value || null)}
              className="h-8 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-1 text-xs"
            >
              <option value="">Select an existing item…</option>
              {candidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.description}
                </option>
              ))}
            </select>
          )}
        </div>
      </td>
    </tr>
  );
}

function VariationRow({
  variation,
  projectId,
  importId,
  candidates,
  onChanged
}: {
  variation: ImportVariation;
  projectId: string;
  importId: string;
  candidates: { id: string; reference: string; title: string; closed: boolean }[];
  onChanged: () => void;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const action = effectiveVariationAction(variation);
  const needsCandidate = ["match_existing", "update_existing", "reactivate_and_update"].includes(action);

  async function save(userAction: string, matchedVariationItemId?: string | null) {
    setIsSaving(true);
    setError(null);
    const response = await fetch(`/api/projects/${projectId}/payment-claim-imports/${importId}/variations/${variation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userAction, ...(matchedVariationItemId !== undefined ? { matchedVariationItemId } : {}) })
    });
    setIsSaving(false);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not save this change.");
      return;
    }
    onChanged();
  }

  const availableActions = variation.existingRecordClosed
    ? (["reactivate_and_update", "create_new", "ignore"] as const)
    : (["match_existing", "create_new", "update_existing", "reactivate_and_update", "ignore"] as const);

  return (
    <tr className="border-b border-[#e7edf3] dark:border-slate-800 align-top">
      <td className="py-2 pr-3 font-medium">{variation.reference ?? "—"}</td>
      <td className="py-2 pr-3">
        <p>{variation.description}</p>
        {variation.approvalStatusRaw && (
          <p className="text-[11px] text-[#4c739a] dark:text-slate-400 mt-1">Claim states: {variation.approvalStatusRaw}</p>
        )}
        {variation.conflictNote && <p className="text-[11px] text-red-600 dark:text-red-400 mt-1">{variation.conflictNote}</p>}
        {!variation.conflictNote && variation.matchReason && (
          <p className="text-[11px] text-[#4c739a] dark:text-slate-400 mt-1">{variation.matchReason}</p>
        )}
        {variation.existingRecordClosed && (
          <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
            This record was previously closed. Choose &quot;Reactivate &amp; update&quot; to bring it back and apply this claim&apos;s
            figures, or leave it closed by choosing another action.
          </p>
        )}
      </td>
      <td className="py-2 pr-3 text-right">{formatCurrency(variation.submittedValue)}</td>
      <td className="py-2 pr-3 text-right">{formatCurrency(variation.approvedValue)}</td>
      <td className="py-2 pr-3 text-right">{variation.claimedPercentToDate != null ? `${variation.claimedPercentToDate}%` : "—"}</td>
      <td className="py-2 pr-3">
        <StatusBadge status={variation.matchStatus} />
      </td>
      <td className="py-2">
        <div className="flex flex-col gap-1 min-w-[12rem]">
          <select
            value={action}
            disabled={isSaving}
            onChange={(event) => save(event.target.value)}
            className="h-8 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-1 text-xs"
          >
            {availableActions.map((value) => (
              <option key={value} value={value}>
                {VARIATION_ACTION_LABELS[value]}
              </option>
            ))}
          </select>
          {needsCandidate && (
            <select
              value={variation.matchedVariationItemId ?? ""}
              disabled={isSaving}
              onChange={(event) => save(action, event.target.value || null)}
              className="h-8 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-1 text-xs"
            >
              <option value="">Select an existing record…</option>
              {candidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.reference} — {candidate.title}
                  {candidate.closed ? " (closed)" : ""}
                </option>
              ))}
            </select>
          )}
          {error && <p className="text-[10px] text-red-600 dark:text-red-400">{error}</p>}
        </div>
      </td>
    </tr>
  );
}

export function PaymentClaimImportReviewView({
  projectId,
  projectName,
  retentionPercent,
  contractItemCandidates,
  variationCandidates,
  importRecord
}: {
  projectId: string;
  projectName: string;
  retentionPercent: number | null;
  contractItemCandidates: { id: string; description: string }[];
  variationCandidates: { id: string; reference: string; title: string; closed: boolean }[];
  importRecord: ImportRecord;
}) {
  const router = useRouter();
  const [baselineDateInput, setBaselineDateInput] = useState(importRecord.baselineDate ? importRecord.baselineDate.slice(0, 10) : "");
  const [isConfirming, setIsConfirming] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  function refresh() {
    router.refresh();
  }

  async function handleConfirm() {
    setConfirmError(null);
    setIsConfirming(true);
    const response = await fetch(`/api/projects/${projectId}/payment-claim-imports/${importRecord.id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baselineDate: importRecord.baselineDate ? null : baselineDateInput || null })
    });
    setIsConfirming(false);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setConfirmError(typeof data.error === "string" ? data.error : "Could not import this payment claim.");
      return;
    }
    router.refresh();
  }

  async function handleReject() {
    setIsRejecting(true);
    await fetch(`/api/projects/${projectId}/payment-claim-imports/${importRecord.id}/reject`, { method: "POST" });
    setIsRejecting(false);
    router.push(`/projects/${projectId}/payment-claims`);
    router.refresh();
  }

  if (importRecord.status === "rejected") {
    return (
      <div className="max-w-3xl mx-auto py-10 text-center">
        <p className="font-bold mb-2">This import was cancelled</p>
        <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-4">
          Nothing was changed in the project. The uploaded document ({importRecord.fileName}) is still on file.
        </p>
        <Link href={`/projects/${projectId}/payment-claims`} className="text-primary hover:underline font-bold">
          Back to Payment Claims
        </Link>
      </div>
    );
  }

  if (importRecord.status === "confirmed") {
    const matchedItems = importRecord.items.filter((i) => i.userAction === "accept_match").length;
    const createdItems = importRecord.items.filter((i) => i.userAction === "create_new").length;
    const matchedVariations = importRecord.variations.filter((v) => ["match_existing", "update_existing", "reactivate_and_update"].includes(v.userAction)).length;
    const createdVariations = importRecord.variations.filter((v) => v.userAction === "create_new").length;
    const conflicts = [...importRecord.items, ...importRecord.variations].filter((row) => row.matchStatus === "conflict" && row.userAction === "ignore").length;

    return (
      <div className="max-w-3xl mx-auto py-8 flex flex-col gap-4">
        <div className="text-center">
          <p className="text-lg font-bold">Payment Claim Imported</p>
          <p className="text-sm text-[#4c739a] dark:text-slate-400">
            {importRecord.externalClaimReference ?? importRecord.fileName} · Baseline: {formatDate(importRecord.baselineDate)}
          </p>
        </div>

        <div className="rounded-xl border border-[#e7edf3] dark:border-slate-700 p-4 grid grid-cols-2 gap-3 text-sm">
          <p>Imported: <span className="font-bold">{importRecord.items.length + importRecord.variations.length} lines</span></p>
          <p>Original contract value: <span className="font-bold">{formatCurrency(importRecord.originalContractSum)}</span></p>
          <p>Matched: <span className="font-bold">{matchedItems} contract items, {matchedVariations} variations</span></p>
          <p>Approved variations: <span className="font-bold">{formatCurrency(importRecord.approvedVariationsTotal)}</span></p>
          <p>Created: <span className="font-bold">{createdItems} contract items, {createdVariations} variations</span></p>
          <p>Claimed to date: <span className="font-bold">{formatCurrency(importRecord.grossClaimToDate)}</span></p>
          <p>Requires attention: <span className="font-bold">{conflicts} unresolved discrepanc{conflicts === 1 ? "y" : "ies"}</span></p>
          <p>Retention held (stated): <span className="font-bold">{formatCurrency(importRecord.retentionToDateStated)}</span></p>
        </div>

        <div className="flex items-center justify-center gap-4">
          {importRecord.resultingPaymentClaimId && (
            <Link
              href={`/projects/${projectId}/payment-claims/${importRecord.resultingPaymentClaimId}`}
              className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 flex items-center"
            >
              View Payment Claim
            </Link>
          )}
          <Link
            href={`/projects/${projectId}`}
            className="h-10 px-4 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-bold flex items-center"
          >
            View Project
          </Link>
        </div>
      </div>
    );
  }

  const unresolvedRequiredCount =
    importRecord.items.filter((i) => ["conflict", "unresolved"].includes(i.matchStatus) && i.userAction === "pending").length +
    importRecord.variations.filter((v) => ["conflict", "unresolved"].includes(v.matchStatus) && v.userAction === "pending").length;

  const hypotheticalRetention =
    retentionPercent != null && importRecord.grossClaimToDate != null ? (importRecord.grossClaimToDate * retentionPercent) / 100 : null;

  return (
    <div className="max-w-5xl mx-auto py-8 flex flex-col gap-6">
      <div>
        <Link href={`/projects/${projectId}/payment-claims`} className="text-xs text-primary hover:underline">
          ← All claims
        </Link>
        <h1 className="text-lg font-bold mt-1">Payment Claim Import</h1>
        <p className="text-sm text-[#4c739a] dark:text-slate-400">
          {importRecord.externalClaimReference ?? importRecord.fileName}
          {importRecord.periodEnd && ` · Period ending: ${formatDate(importRecord.periodEnd)}`}
        </p>
      </div>

      {importRecord.aiConfidence != null && importRecord.aiConfidence < 0.6 && (
        <p className="text-sm rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 p-3">
          This extraction had low confidence — please check every figure carefully before importing.
          {importRecord.aiNotes && <span className="block mt-1">{importRecord.aiNotes}</span>}
        </p>
      )}
      {importRecord.arithmeticWarning && (
        <p className="text-sm rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 p-3">
          Source document does not reconcile: {importRecord.arithmeticWarning}
        </p>
      )}

      {(importRecord.projectNameOnDocument || importRecord.projectReferenceOnDocument) && (
        <div className="rounded-lg border border-[#e7edf3] dark:border-slate-700 p-3 text-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-[#4c739a] dark:text-slate-400 mb-1">On the uploaded document</p>
          {importRecord.projectNameOnDocument && (
            <p>
              Project name: <span className="font-medium">{importRecord.projectNameOnDocument}</span>
              {projectName && importRecord.projectNameOnDocument.trim().toLowerCase() !== projectName.trim().toLowerCase() && (
                <span className="text-amber-700 dark:text-amber-400"> — differs from Subbie HQ&apos;s &quot;{projectName}&quot;</span>
              )}
            </p>
          )}
          {importRecord.contractReferenceOnDocument && <p>Contract reference: {importRecord.contractReferenceOnDocument}</p>}
        </div>
      )}

      <div className="rounded-xl border border-[#e7edf3] dark:border-slate-700 p-4">
        <p className="font-bold mb-3">We found:</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <p>{importRecord.items.length} contract schedule items</p>
          <p>{importRecord.variations.length} variations</p>
          <p>{formatCurrency(importRecord.originalContractSum)} original subcontract value</p>
          <p>{formatCurrency(importRecord.approvedVariationsTotal)} approved variations</p>
          <p>{formatCurrency(importRecord.grossClaimToDate)} claimed to date</p>
          <p>{formatCurrency(importRecord.retentionToDateStated)} retention held (stated)</p>
        </div>
        <p className="text-xs text-[#4c739a] dark:text-slate-400 mt-3">Review the information below before importing it into your project.</p>
      </div>

      <div className="rounded-xl border border-[#e7edf3] dark:border-slate-700 p-4">
        <p className="font-bold mb-2">Baseline date</p>
        {importRecord.baselineDate ? (
          <p className="text-sm">
            Your project will be brought up to date as at <span className="font-bold">{formatDate(importRecord.baselineDate)}</span>.
          </p>
        ) : (
          <div className="flex items-center gap-2">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              No claim period or date was found on the document — please confirm the baseline date before importing.
            </p>
            <input
              type="date"
              value={baselineDateInput}
              onChange={(event) => setBaselineDateInput(event.target.value)}
              className="h-9 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm"
            />
          </div>
        )}
      </div>

      <div className="rounded-xl border border-[#e7edf3] dark:border-slate-700 p-4">
        <p className="font-bold mb-1">Retention</p>
        <p className="text-sm">Payment claim states retention held: <span className="font-bold">{formatCurrency(importRecord.retentionToDateStated)}</span></p>
        <p className="text-sm">
          Subbie HQ would calculate (at {retentionPercent ?? "—"}% configured retention):{" "}
          <span className="font-bold">{hypotheticalRetention != null ? formatCurrency(hypotheticalRetention) : "— (retention % not yet configured)"}</span>
        </p>
        {importRecord.retentionToDateStated != null && hypotheticalRetention != null && Math.abs(importRecord.retentionToDateStated - hypotheticalRetention) > 1 && (
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
            These figures differ — both are kept, nothing is overwritten automatically. Contract retention terms come from the
            Contract page, never from this import.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-[#e7edf3] dark:border-slate-700 p-4 overflow-x-auto">
        <p className="font-bold mb-3">Contract Schedule Items (B2)</p>
        <table className="w-full text-xs min-w-[800px]">
          <thead>
            <tr className="text-left text-[#4c739a] dark:text-slate-400 border-b border-[#e7edf3] dark:border-slate-700">
              <th className="py-1.5 pr-3">Item</th>
              <th className="py-1.5 pr-3">Description</th>
              <th className="py-1.5 pr-3 text-right">Contract Value</th>
              <th className="py-1.5 pr-3 text-right">% Claimed</th>
              <th className="py-1.5 pr-3">Match</th>
              <th className="py-1.5">Action</th>
            </tr>
          </thead>
          <tbody>
            {importRecord.items.map((item) => (
              <ItemRow key={item.id} item={item} projectId={projectId} importId={importRecord.id} candidates={contractItemCandidates} onChanged={refresh} />
            ))}
            {importRecord.items.length === 0 && (
              <tr>
                <td colSpan={6} className="py-3 text-center text-[#4c739a] dark:text-slate-400">
                  No contract schedule items were found on this document.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-[#e7edf3] dark:border-slate-700 p-4 overflow-x-auto">
        <p className="font-bold mb-3">Variations (B3)</p>
        <table className="w-full text-xs min-w-[900px]">
          <thead>
            <tr className="text-left text-[#4c739a] dark:text-slate-400 border-b border-[#e7edf3] dark:border-slate-700">
              <th className="py-1.5 pr-3">Claim Ref</th>
              <th className="py-1.5 pr-3">Description</th>
              <th className="py-1.5 pr-3 text-right">Submitted</th>
              <th className="py-1.5 pr-3 text-right">Approved</th>
              <th className="py-1.5 pr-3 text-right">% Claimed</th>
              <th className="py-1.5 pr-3">Match</th>
              <th className="py-1.5">Action</th>
            </tr>
          </thead>
          <tbody>
            {importRecord.variations.map((variation) => (
              <VariationRow
                key={variation.id}
                variation={variation}
                projectId={projectId}
                importId={importRecord.id}
                candidates={variationCandidates}
                onChanged={refresh}
              />
            ))}
            {importRecord.variations.length === 0 && (
              <tr>
                <td colSpan={7} className="py-3 text-center text-[#4c739a] dark:text-slate-400">
                  No variations were found on this document.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {unresolvedRequiredCount > 0 && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          {unresolvedRequiredCount} row{unresolvedRequiredCount === 1 ? "" : "s"} above need a decision (conflict or multiple possible
          matches) — anything left as-is will simply be skipped, not guessed.
        </p>
      )}

      {confirmError && <p className="text-sm text-red-600 dark:text-red-400">{confirmError}</p>}

      <div className="flex items-center justify-end gap-3 pb-8">
        <button onClick={handleReject} disabled={isRejecting} className="h-10 px-4 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-medium disabled:opacity-60">
          {isRejecting ? "Cancelling..." : "Cancel Import"}
        </button>
        <button
          onClick={handleConfirm}
          disabled={isConfirming || (!importRecord.baselineDate && !baselineDateInput)}
          className="h-10 px-6 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
        >
          {isConfirming ? "Importing..." : "Confirm & Import"}
        </button>
      </div>
    </div>
  );
}
