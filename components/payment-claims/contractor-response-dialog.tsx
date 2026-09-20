"use client";

import { useState } from "react";

function formatCurrency(amount: number) {
  return amount.toLocaleString("en-NZ", { style: "currency", currency: "NZD" });
}

export type DeclineLineForm = { description: string; amount: string; reason: string; variationItemId: string };
export type AdjustmentForm = { description: string; amount: string };

export type VariationOption = { id: string; reference: string; title: string };

function emptyDeclineLine(): DeclineLineForm {
  return { description: "", amount: "", reason: "", variationItemId: "" };
}
function emptyAdjustment(): AdjustmentForm {
  return { description: "", amount: "" };
}

// Backs BOTH the manual "Record contractor response" entry AND the review
// of a draft AI extraction — same fields either way (Sections 11/18 of
// the spec this implements describe one shared shape), the only
// difference is which fields start pre-filled and which action button(s)
// are shown.
export type ContractorResponseFormState = {
  claimedAmount: string;
  certifiedAmount: string;
  declineLines: DeclineLineForm[];
  statedRetentionAmount: string;
  adjustments: AdjustmentForm[];
  receivedAmount: string;
  paymentDueDate: string;
  paymentReceivedDate: string;
};

export function emptyContractorResponseForm(prefillClaimedAmount: number): ContractorResponseFormState {
  return {
    claimedAmount: String(prefillClaimedAmount),
    certifiedAmount: "",
    declineLines: [],
    statedRetentionAmount: "",
    adjustments: [],
    receivedAmount: "",
    paymentDueDate: "",
    paymentReceivedDate: ""
  };
}

function num(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function ContractorResponseDialog({
  title,
  mode,
  initialState,
  variationOptions,
  calculatedRetention,
  aiConfidence,
  aiNotes,
  onClose,
  onSave,
  onConfirm
}: {
  title: string;
  // "create": manual entry, saving confirms immediately.
  // "review": editing a draft (from document upload) — Save keeps it a
  // draft, Confirm is a separate explicit action (Section 19).
  mode: "create" | "review";
  initialState: ContractorResponseFormState;
  variationOptions: VariationOption[];
  // Subbie HQ's own computeTotalRetentionWithheld figure, shown side by
  // side with the contractor's stated retention — never substituted for
  // it (Section 10.2/26).
  calculatedRetention: number;
  aiConfidence?: number | null;
  aiNotes?: string | null;
  onClose: () => void;
  onSave: (state: ContractorResponseFormState) => Promise<string | null>;
  onConfirm?: () => Promise<string | null>;
}) {
  const [state, setState] = useState(initialState);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const claimedAmount = num(state.claimedAmount);
  const certifiedAmount = num(state.certifiedAmount);
  const declinedAmount = state.declineLines.reduce((sum, line) => sum + (num(line.amount) ?? 0), 0);
  const statedRetention = num(state.statedRetentionAmount);
  // Purely a live UI hint, mirroring lib/payment-reconciliation.ts's own
  // checkClaimReconciliation tolerance — never blocks saving or confirming
  // (Section 18: "the human may have identified a legitimate reason for
  // the discrepancy").
  const reconciles =
    claimedAmount == null || certifiedAmount == null ? null : Math.abs(claimedAmount - (certifiedAmount + declinedAmount)) <= 1;

  function updateDeclineLine(index: number, field: keyof DeclineLineForm, value: string) {
    setState((current) => ({
      ...current,
      declineLines: current.declineLines.map((line, i) => (i === index ? { ...line, [field]: value } : line))
    }));
  }
  function updateAdjustment(index: number, field: keyof AdjustmentForm, value: string) {
    setState((current) => ({
      ...current,
      adjustments: current.adjustments.map((adjustment, i) => (i === index ? { ...adjustment, [field]: value } : adjustment))
    }));
  }

  async function handleSave() {
    setError(null);
    setIsSaving(true);
    const result = await onSave(state);
    setIsSaving(false);
    if (result) {
      setError(result);
      return;
    }
    if (mode === "create") onClose();
  }

  async function handleConfirm() {
    if (!onConfirm) return;
    setError(null);
    setIsConfirming(true);
    const result = await onConfirm();
    setIsConfirming(false);
    if (result) {
      setError(result);
      return;
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="relative w-full max-w-3xl rounded-xl bg-white dark:bg-slate-900 p-6 shadow-lg max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 rounded-lg p-1 text-[#4c739a] hover:bg-[#e7edf3] dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>

        <h2 className="text-lg font-bold mb-1">{title}</h2>
        {mode === "review" && (
          <p className="text-sm text-amber-700 dark:text-amber-400 mb-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 px-3 py-2">
            Draft contractor response — review required. Every field below was extracted automatically; check and correct anything
            before confirming.
            {aiConfidence != null && aiConfidence < 0.6 && " This extraction had low confidence — please check carefully."}
            {aiNotes && <span className="block mt-1">{aiNotes}</span>}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 mb-3">
          <label className="flex flex-col gap-1 text-xs font-medium">
            Amount claimed
            <input
              type="number"
              step="0.01"
              value={state.claimedAmount}
              onChange={(event) => setState((current) => ({ ...current, claimedAmount: event.target.value }))}
              className="h-9 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium">
            Amount certified / approved
            <input
              type="number"
              step="0.01"
              value={state.certifiedAmount}
              onChange={(event) => setState((current) => ({ ...current, certifiedAmount: event.target.value }))}
              className="h-9 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm"
            />
          </label>
        </div>

        {reconciles === false && (
          <p className="text-xs text-amber-700 dark:text-amber-400 mb-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 px-3 py-2">
            Claimed ({claimedAmount != null ? formatCurrency(claimedAmount) : "—"}) doesn't equal certified + declined (
            {formatCurrency((certifiedAmount ?? 0) + declinedAmount)}). You can still save or confirm — there may be a legitimate
            reason for the difference.
          </p>
        )}

        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-bold">Decline lines</p>
            <p className="text-xs text-[#4c739a] dark:text-slate-400">Total declined: {formatCurrency(declinedAmount)}</p>
          </div>
          <div className="flex flex-col gap-2">
            {state.declineLines.map((line, index) => (
              <div key={index} className="rounded-lg border border-[#e7edf3] dark:border-slate-700 p-2 flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Description"
                    value={line.description}
                    onChange={(event) => updateDeclineLine(index, "description", event.target.value)}
                    className="h-8 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs"
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Amount"
                    value={line.amount}
                    onChange={(event) => updateDeclineLine(index, "amount", event.target.value)}
                    className="h-8 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Reason"
                  value={line.reason}
                  onChange={(event) => updateDeclineLine(index, "reason", event.target.value)}
                  className="h-8 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs"
                />
                <div className="flex items-center gap-2">
                  <select
                    value={line.variationItemId}
                    onChange={(event) => updateDeclineLine(index, "variationItemId", event.target.value)}
                    className="h-8 flex-1 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs"
                  >
                    <option value="">No linked Variation/SI (optional)</option>
                    {variationOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.reference} — {option.title}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      setState((current) => ({ ...current, declineLines: current.declineLines.filter((_, i) => i !== index) }))
                    }
                    className="text-red-600 text-xs font-bold hover:underline shrink-0"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setState((current) => ({ ...current, declineLines: [...current.declineLines, emptyDeclineLine()] }))}
            className="mt-2 text-xs font-bold text-primary hover:underline"
          >
            + Add decline line
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <label className="flex flex-col gap-1 text-xs font-medium">
            Retention withheld (contractor stated)
            <input
              type="number"
              step="0.01"
              value={state.statedRetentionAmount}
              onChange={(event) => setState((current) => ({ ...current, statedRetentionAmount: event.target.value }))}
              className="h-9 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm"
            />
          </label>
          <div className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-[#4c739a] dark:text-slate-400">Subbie HQ calculated (project total)</span>
            <span className="h-9 flex items-center px-2 text-sm">{formatCurrency(calculatedRetention)}</span>
            {statedRetention != null && Math.abs(statedRetention - calculatedRetention) > 1 && (
              <span className="text-amber-700 dark:text-amber-400">Retention discrepancy — figures kept separate, not reconciled automatically.</span>
            )}
          </div>
        </div>

        <div className="mb-3">
          <p className="text-xs font-bold mb-1">Credits / adjustments</p>
          <div className="flex flex-col gap-2">
            {state.adjustments.map((adjustment, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Description"
                  value={adjustment.description}
                  onChange={(event) => updateAdjustment(index, "description", event.target.value)}
                  className="h-8 flex-1 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Amount (+/-)"
                  value={adjustment.amount}
                  onChange={(event) => updateAdjustment(index, "amount", event.target.value)}
                  className="h-8 w-32 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setState((current) => ({ ...current, adjustments: current.adjustments.filter((_, i) => i !== index) }))}
                  className="text-red-600 text-xs font-bold hover:underline shrink-0"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setState((current) => ({ ...current, adjustments: [...current.adjustments, emptyAdjustment()] }))}
            className="mt-2 text-xs font-bold text-primary hover:underline"
          >
            + Add credit/adjustment
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <label className="flex flex-col gap-1 text-xs font-medium">
            Amount actually received <span className="text-[#4c739a] dark:text-slate-400">(optional)</span>
            <input
              type="number"
              step="0.01"
              value={state.receivedAmount}
              onChange={(event) => setState((current) => ({ ...current, receivedAmount: event.target.value }))}
              className="h-9 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium">
            Payment date <span className="text-[#4c739a] dark:text-slate-400">(only if received)</span>
            <input
              type="date"
              value={state.paymentReceivedDate}
              disabled={!state.receivedAmount}
              onChange={(event) => setState((current) => ({ ...current, paymentReceivedDate: event.target.value }))}
              className="h-9 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm disabled:opacity-50"
            />
          </label>
        </div>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="h-10 px-4 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-medium">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !state.certifiedAmount}
            className={
              mode === "create"
                ? "h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
                : "h-10 px-4 rounded-lg border border-primary text-primary text-sm font-bold disabled:opacity-60"
            }
          >
            {isSaving ? "Saving..." : mode === "create" ? "Save contractor response" : "Save draft"}
          </button>
          {mode === "review" && onConfirm && (
            <button
              onClick={handleConfirm}
              disabled={isConfirming || isSaving || !state.certifiedAmount}
              className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
            >
              {isConfirming ? "Confirming..." : "Confirm"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
