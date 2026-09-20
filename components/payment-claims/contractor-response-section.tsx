"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ContractorResponseDialog,
  emptyContractorResponseForm,
  type ContractorResponseFormState,
  type VariationOption
} from "@/components/payment-claims/contractor-response-dialog";

function formatCurrency(amount: number) {
  return amount.toLocaleString("en-NZ", { style: "currency", currency: "NZD" });
}
function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

export type SerializedDeclineLine = { id: string; description: string; amount: number; reason: string; variationItemId: string | null };
export type SerializedAdjustment = { id: string; description: string; amount: number };
export type SerializedReconciliation = {
  id: string;
  source: "manual" | "document_upload";
  status: "draft" | "confirmed";
  claimedAmount: number | null;
  certifiedAmount: number | null;
  declinedAmount: number;
  statedRetentionAmount: number | null;
  receivedAmount: number | null;
  paymentDueDate: string | null;
  paymentReceivedDate: string | null;
  fileName: string | null;
  aiConfidence: number | null;
  aiNotes: string | null;
  confirmedAt: string | null;
  createdAt: string;
  declineLines: SerializedDeclineLine[];
  adjustments: SerializedAdjustment[];
};

function toFormState(schedule: SerializedReconciliation): ContractorResponseFormState {
  return {
    claimedAmount: schedule.claimedAmount != null ? String(schedule.claimedAmount) : "",
    certifiedAmount: schedule.certifiedAmount != null ? String(schedule.certifiedAmount) : "",
    declineLines: schedule.declineLines.map((line) => ({
      description: line.description,
      amount: String(line.amount),
      reason: line.reason,
      variationItemId: line.variationItemId ?? ""
    })),
    statedRetentionAmount: schedule.statedRetentionAmount != null ? String(schedule.statedRetentionAmount) : "",
    adjustments: schedule.adjustments.map((adjustment) => ({ description: adjustment.description, amount: String(adjustment.amount) })),
    receivedAmount: schedule.receivedAmount != null ? String(schedule.receivedAmount) : "",
    paymentDueDate: schedule.paymentDueDate ? schedule.paymentDueDate.slice(0, 10) : "",
    paymentReceivedDate: schedule.paymentReceivedDate ? schedule.paymentReceivedDate.slice(0, 10) : ""
  };
}

function toRequestBody(state: ContractorResponseFormState) {
  return {
    claimedAmount: state.claimedAmount === "" ? null : Number(state.claimedAmount),
    certifiedAmount: state.certifiedAmount === "" ? null : Number(state.certifiedAmount),
    declineLines: state.declineLines
      .filter((line) => line.description.trim() && line.amount !== "")
      .map((line) => ({
        description: line.description.trim(),
        amount: Number(line.amount),
        reason: line.reason.trim() || "Not stated",
        variationItemId: line.variationItemId || null
      })),
    statedRetentionAmount: state.statedRetentionAmount === "" ? null : Number(state.statedRetentionAmount),
    adjustments: state.adjustments
      .filter((adjustment) => adjustment.description.trim() && adjustment.amount !== "")
      .map((adjustment) => ({ description: adjustment.description.trim(), amount: Number(adjustment.amount) })),
    receivedAmount: state.receivedAmount === "" ? null : Number(state.receivedAmount),
    paymentDueDate: state.paymentDueDate || null,
    paymentReceivedDate: state.paymentReceivedDate || null
  };
}

function ConfirmedSummary({ schedule }: { schedule: SerializedReconciliation }) {
  const outstanding =
    schedule.certifiedAmount != null && schedule.receivedAmount != null
      ? schedule.certifiedAmount - schedule.receivedAmount
      : null;

  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-4 text-sm">
        <div>
          <dt className="text-xs text-[#4c739a] dark:text-slate-400">Claimed</dt>
          <dd className="font-bold">{schedule.claimedAmount != null ? formatCurrency(schedule.claimedAmount) : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-[#4c739a] dark:text-slate-400">Certified</dt>
          <dd className="font-bold">{schedule.certifiedAmount != null ? formatCurrency(schedule.certifiedAmount) : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-[#4c739a] dark:text-slate-400">Declined</dt>
          <dd className="font-bold">{formatCurrency(schedule.declinedAmount)}</dd>
        </div>
        <div>
          <dt className="text-xs text-[#4c739a] dark:text-slate-400">Received</dt>
          <dd className="font-bold">{schedule.receivedAmount != null ? formatCurrency(schedule.receivedAmount) : "Not recorded"}</dd>
        </div>
        <div>
          <dt className="text-xs text-[#4c739a] dark:text-slate-400">Outstanding</dt>
          <dd className="font-bold">{outstanding != null ? formatCurrency(outstanding) : "Unknown"}</dd>
        </div>
        {schedule.paymentReceivedDate && (
          <div>
            <dt className="text-xs text-[#4c739a] dark:text-slate-400">Paid on</dt>
            <dd className="font-bold">{formatDate(schedule.paymentReceivedDate)}</dd>
          </div>
        )}
      </dl>

      {schedule.declineLines.length > 0 && (
        <div>
          <p className="text-xs font-bold mb-1">Decline lines</p>
          <div className="flex flex-col gap-1">
            {schedule.declineLines.map((line) => (
              <p key={line.id} className="text-xs text-[#4c739a] dark:text-slate-400">
                <span className="font-bold text-[#0d141b] dark:text-slate-50">{formatCurrency(line.amount)}</span> — {line.description}
                <span className="block">{line.reason}</span>
              </p>
            ))}
          </div>
        </div>
      )}

      {schedule.statedRetentionAmount != null && (
        <p className="text-xs text-[#4c739a] dark:text-slate-400">
          Contractor stated retention: {formatCurrency(schedule.statedRetentionAmount)}
        </p>
      )}
      {schedule.fileName && <p className="text-xs text-[#4c739a] dark:text-slate-400">Source document: {schedule.fileName}</p>}
    </div>
  );
}

export function ContractorResponseSection({
  projectId,
  claimId,
  claimedAmount,
  calculatedRetention,
  variationOptions,
  history
}: {
  projectId: string;
  claimId: string;
  claimedAmount: number;
  calculatedRetention: number;
  variationOptions: VariationOption[];
  history: SerializedReconciliation[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ mode: "create" | "review"; schedule: SerializedReconciliation | null } | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const latestConfirmed = history.find((schedule) => schedule.status === "confirmed") ?? null;
  const latestDraft = history.find((schedule) => schedule.status === "draft") ?? null;
  const earlierConfirmed = history.filter((schedule) => schedule.status === "confirmed" && schedule.id !== latestConfirmed?.id);

  async function handleUploadChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploadError(null);
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`/api/projects/${projectId}/payment-claims/${claimId}/reconciliation/extract`, {
        method: "POST",
        body: formData
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setUploadError(typeof data.error === "string" ? data.error : "Could not read this document automatically.");
        return;
      }
      router.refresh();
      setDialog({ mode: "review", schedule: data.schedule });
    } finally {
      setIsUploading(false);
    }
  }

  async function saveManual(state: ContractorResponseFormState): Promise<string | null> {
    const response = await fetch(`/api/projects/${projectId}/payment-claims/${claimId}/reconciliation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toRequestBody(state))
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return typeof data.error === "string" ? data.error : "Could not save this response.";
    }
    router.refresh();
    return null;
  }

  async function saveDraft(scheduleId: string, state: ContractorResponseFormState): Promise<string | null> {
    const response = await fetch(`/api/projects/${projectId}/payment-claims/${claimId}/reconciliation/${scheduleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toRequestBody(state))
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return typeof data.error === "string" ? data.error : "Could not save this response.";
    }
    router.refresh();
    return null;
  }

  async function confirmDraft(scheduleId: string): Promise<string | null> {
    const response = await fetch(`/api/projects/${projectId}/payment-claims/${claimId}/reconciliation/${scheduleId}/confirm`, {
      method: "POST"
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return typeof data.error === "string" ? data.error : "Could not confirm this response.";
    }
    router.refresh();
    return null;
  }

  return (
    <div className="rounded-xl border border-[#e7edf3] dark:border-slate-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold">Contractor Response / Payment Reconciliation</h3>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setDialog({ mode: "create", schedule: null })}
            className="text-xs font-bold text-primary hover:underline"
          >
            Record contractor response
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="text-xs font-bold text-primary hover:underline disabled:opacity-60"
          >
            {isUploading ? "Reading document..." : "Upload Payment Schedule"}
          </button>
          <input ref={fileInputRef} type="file" accept="application/pdf,image/png,image/jpeg" className="hidden" onChange={handleUploadChange} />
        </div>
      </div>

      {uploadError && <p className="text-xs text-red-600 dark:text-red-400 mb-3">{uploadError}</p>}

      {latestDraft && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/10 px-3 py-2 flex items-center justify-between gap-3 mb-3">
          <div>
            <p className="text-xs font-bold text-amber-800 dark:text-amber-300">Draft response — review required</p>
            <p className="text-[11px] text-amber-700 dark:text-amber-400">
              {latestDraft.source === "document_upload" ? `Extracted from ${latestDraft.fileName ?? "an uploaded document"}` : "Draft entry"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDialog({ mode: "review", schedule: latestDraft })}
            className="h-8 px-3 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 shrink-0"
          >
            Review
          </button>
        </div>
      )}

      {latestConfirmed ? (
        <ConfirmedSummary schedule={latestConfirmed} />
      ) : !latestDraft ? (
        <p className="text-sm text-[#4c739a] dark:text-slate-400">Awaiting contractor response.</p>
      ) : null}

      {earlierConfirmed.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[#e7edf3] dark:border-slate-800">
          <button type="button" onClick={() => setShowHistory((current) => !current)} className="text-xs font-bold text-primary hover:underline">
            {showHistory ? "Hide" : "Show"} earlier responses ({earlierConfirmed.length})
          </button>
          {showHistory && (
            <div className="flex flex-col gap-3 mt-2">
              {earlierConfirmed.map((schedule) => (
                <div key={schedule.id} className="rounded-lg border border-[#e7edf3] dark:border-slate-800 p-3">
                  <p className="text-[11px] text-[#4c739a] dark:text-slate-400 mb-2">
                    Confirmed {schedule.confirmedAt ? formatDate(schedule.confirmedAt) : ""}
                  </p>
                  <ConfirmedSummary schedule={schedule} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {dialog && (
        <ContractorResponseDialog
          title={dialog.mode === "create" ? "Record contractor response" : "Review contractor response"}
          mode={dialog.mode}
          initialState={dialog.schedule ? toFormState(dialog.schedule) : emptyContractorResponseForm(claimedAmount)}
          variationOptions={variationOptions}
          calculatedRetention={calculatedRetention}
          aiConfidence={dialog.schedule?.aiConfidence}
          aiNotes={dialog.schedule?.aiNotes}
          onClose={() => setDialog(null)}
          onSave={(state) => (dialog.mode === "create" ? saveManual(state) : saveDraft(dialog.schedule!.id, state))}
          onConfirm={dialog.mode === "review" ? () => confirmDraft(dialog.schedule!.id) : undefined}
        />
      )}
    </div>
  );
}
