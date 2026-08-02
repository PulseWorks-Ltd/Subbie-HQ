"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ContractTerms } from "@prisma/client";

// Values here can be entered manually, or suggested from a Contract Review
// run (see extractContractTermsFromClauses / ContractTerms.suggestedX
// fields) — same suggest-don't-overwrite pattern as ContractTermsSection,
// kept in its own card since these are user-facing operational rates
// rather than AI-extracted contract reference data (conflating the two
// would be confusing). Nothing in the app applies these to a Day Works
// Sheet total automatically yet unless the Day Works labour extraction
// feature is built — see prisma/schema.prisma's comment on ContractTerms.
type FieldKey = "materialsMarkupPercent" | "dayWorksRateNormal" | "dayWorksRateNight" | "dayWorksRateSundayHoliday";

const FIELDS: { key: FieldKey; label: string; suffix: string; helpText?: string }[] = [
  { key: "materialsMarkupPercent", label: "Materials markup", suffix: "%" },
  {
    key: "dayWorksRateNormal",
    label: "Day works rate — Normal hours",
    suffix: "$/hr",
    helpText: "Normal hours: Monday–Saturday, 7am–5pm"
  },
  { key: "dayWorksRateNight", label: "Day works rate — Night", suffix: "$/hr" },
  { key: "dayWorksRateSundayHoliday", label: "Day works rate — Sunday / Public Holiday", suffix: "$/hr" }
];

function getSuggested(contractTerms: ContractTerms | null, key: FieldKey): string | number | null {
  if (!contractTerms) return null;
  const suggestedFieldKey = `suggested${key.charAt(0).toUpperCase()}${key.slice(1)}`;
  const value = (contractTerms as unknown as Record<string, unknown>)[suggestedFieldKey];
  return value === null || value === undefined ? null : (value as string | number);
}

export function DayWorksRatesSection({
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
    const raw = values[key];
    const value = raw === "" ? null : Number(raw);
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
          <h3 className="text-sm font-bold">Day Works Rates</h3>
          <p className="text-xs text-[#4c739a] dark:text-slate-400">
            Used to calculate Day Works Sheet costs automatically. Leave blank to keep entering materials and labour
            manually. Run a Contract Review on the Contract tab to populate suggestions from the contract.
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

      {contractTerms?.suggestedDayWorksRateNotes && (
        <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 rounded-lg px-3 py-2">
          From the contract: {contractTerms.suggestedDayWorksRateNotes}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {FIELDS.map((field) => {
          const suggested = getSuggested(contractTerms, field.key);
          return (
            <div key={field.key} className="flex flex-col gap-1">
              <label className="text-sm font-medium">{field.label}</label>
              {field.helpText && <p className="text-xs text-[#4c739a] dark:text-slate-400">{field.helpText}</p>}
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={values[field.key]}
                  onChange={(event) => setValues((prev) => ({ ...prev, [field.key]: event.target.value }))}
                  onBlur={() => saveField(field.key)}
                  disabled={isSaving}
                  className="h-9 flex-1 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
                />
                <span className="text-xs text-[#4c739a] dark:text-slate-400">{field.suffix}</span>
              </div>
              {suggested !== null && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">
                    suggested: {String(suggested)} {field.suffix}
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
