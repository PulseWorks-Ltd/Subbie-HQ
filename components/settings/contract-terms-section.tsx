"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ContractTerms } from "@prisma/client";

type FieldKey =
  | "paymentClaimMethod"
  | "paymentClaimDay"
  | "variationNoticePeriodDays"
  | "variationNoticeMethod"
  | "retentionPercent"
  | "defectsLiabilityPeriodDays"
  | "disputeNoticeMethod"
  | "generalNoticeMethod";

const FIELDS: { key: FieldKey; label: string; type: "text" | "number"; suffix?: string }[] = [
  { key: "paymentClaimMethod", label: "Payment claim submission method", type: "text" },
  { key: "paymentClaimDay", label: "Payment claim due day of month", type: "number" },
  { key: "variationNoticePeriodDays", label: "Variation notice period", type: "number", suffix: "days" },
  { key: "variationNoticeMethod", label: "Variation notice method", type: "text" },
  { key: "retentionPercent", label: "Retention", type: "number", suffix: "%" },
  { key: "defectsLiabilityPeriodDays", label: "Defects liability period", type: "number", suffix: "days" },
  { key: "disputeNoticeMethod", label: "Dispute notice method", type: "text" },
  { key: "generalNoticeMethod", label: "General notice method", type: "text" }
];

function getSuggested(contractTerms: ContractTerms | null, key: FieldKey): string | number | null {
  if (!contractTerms) return null;
  const suggestedFieldKey = `suggested${key.charAt(0).toUpperCase()}${key.slice(1)}`;
  const value = (contractTerms as unknown as Record<string, unknown>)[suggestedFieldKey];
  return value === null || value === undefined ? null : (value as string | number);
}

export function ContractTermsSection({
  projectId,
  contractTerms
}: {
  projectId: string;
  contractTerms: ContractTerms | null;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<FieldKey, string>>(() => {
    const initial = {} as Record<FieldKey, string>;
    for (const field of FIELDS) {
      const raw = contractTerms?.[field.key];
      initial[field.key] = raw === null || raw === undefined ? "" : String(raw);
    }
    return initial;
  });
  const [isSaving, setIsSaving] = useState(false);

  const suggestedFields = FIELDS.filter((field) => getSuggested(contractTerms, field.key) !== null);

  async function saveField(key: FieldKey) {
    const field = FIELDS.find((f) => f.key === key)!;
    const raw = values[key];
    const value = raw === "" ? null : field.type === "number" ? Number(raw) : raw;
    setIsSaving(true);
    await fetch(`/api/projects/${projectId}/contract-terms`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value })
    });
    setIsSaving(false);
    router.refresh();
  }

  async function confirmFields(keys: FieldKey[]) {
    if (keys.length === 0) return;
    setIsSaving(true);
    await fetch(`/api/projects/${projectId}/contract-terms`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmFields: keys })
    });
    setIsSaving(false);
    router.refresh();
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#cfdbe7] dark:border-slate-800 p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold">Contract Terms</h3>
          <p className="text-xs text-[#4c739a] dark:text-slate-400">
            Reference data extracted from the governing subcontract. Run a Contract Review on the Contract tab to
            populate suggestions.
          </p>
        </div>
        {suggestedFields.length > 0 && (
          <button
            onClick={() => confirmFields(suggestedFields.map((f) => f.key))}
            disabled={isSaving}
            className="h-8 px-3 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 disabled:opacity-60 shrink-0"
          >
            Confirm all suggested
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {FIELDS.map((field) => {
          const suggested = getSuggested(contractTerms, field.key);
          return (
            <div key={field.key} className="flex flex-col gap-1">
              <label className="text-sm font-medium">{field.label}</label>
              <div className="flex items-center gap-2">
                <input
                  type={field.type}
                  value={values[field.key]}
                  onChange={(event) => setValues((prev) => ({ ...prev, [field.key]: event.target.value }))}
                  onBlur={() => saveField(field.key)}
                  className="h-9 flex-1 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                {field.suffix && <span className="text-xs text-[#4c739a] dark:text-slate-400">{field.suffix}</span>}
              </div>
              {suggested !== null && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">
                    suggested: {String(suggested)}
                    {field.suffix ? ` ${field.suffix}` : ""}
                  </span>
                  <button
                    onClick={() => confirmFields([field.key])}
                    disabled={isSaving}
                    className="text-primary font-bold hover:underline disabled:opacity-60"
                  >
                    Confirm
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
