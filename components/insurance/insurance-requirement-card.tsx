"use client";

import { StatusBadge } from "@/components/badges/status-badge";
import { CountdownBadge } from "@/components/badges/countdown-badge";
import type { InsuranceRequirementRow } from "@/components/insurance/insurance-view";

const TYPE_LABELS: Record<string, string> = {
  contract_works: "Contract Works",
  plant_and_equipment: "Plant & Equipment",
  public_liability: "Public Liability",
  motor_vehicle_liability: "Motor Vehicle Liability",
  professional_indemnity: "Professional Indemnity",
  other: "Other"
};

function formatCurrency(amount: number | null) {
  if (amount === null) return null;
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD", maximumFractionDigits: 0 }).format(amount);
}

export function InsuranceRequirementCard({
  requirement,
  projectId,
  onEdit,
  onDelete,
  onConfirm
}: {
  requirement: InsuranceRequirementRow;
  projectId: string;
  onEdit: () => void;
  onDelete: () => void;
  onConfirm: () => void;
}) {
  const isSuggested = requirement.status === "parsed";

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#cfdbe7] dark:border-slate-800 p-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
            {TYPE_LABELS[requirement.type] ?? requirement.type}
          </span>
          <h3 className="font-bold leading-tight mt-1.5">{requirement.label}</h3>
        </div>
        {requirement.certificateExpiresAt && <CountdownBadge date={requirement.certificateExpiresAt} />}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#4c739a] dark:text-slate-400 mb-3">
        <span>{requirement.required ? "Required" : "Optional"}</span>
        {requirement.minimumAmount !== null && <span>Min {formatCurrency(requirement.minimumAmount)}</span>}
        <StatusBadge status={requirement.status} />
      </div>

      {requirement.certificateStorageKey && (
        <a
          href={`/api/projects/${projectId}/insurance-requirements/${requirement.id}/certificate`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-xs mb-3 hover:text-primary"
        >
          <span className="material-symbols-outlined text-sm">description</span>
          {requirement.certificateFileName}
        </a>
      )}

      <div className="flex gap-2 pt-3 border-t border-[#e7edf3] dark:border-slate-800">
        {isSuggested && (
          <button
            onClick={onConfirm}
            className="h-8 px-3 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20"
          >
            Confirm
          </button>
        )}
        <button
          onClick={onEdit}
          className="h-8 px-3 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-xs font-bold hover:bg-[#e7edf3] dark:hover:bg-slate-800"
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          className="h-8 px-3 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
