"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ContractTerms } from "@prisma/client";

// Foundational storage only (see prisma/schema.prisma's comment on
// ContractTerms) — nothing in the app currently reads these fields. A
// later Day Works OCR prompt will apply them automatically, and a
// separate Contract Review extraction prompt may later pre-fill them the
// same way ContractTermsSection's suggested* fields work today; neither
// exists yet, so there's no suggested-value UI here.
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

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#cfdbe7] dark:border-slate-800 p-5 flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-bold">Day Works Rates</h3>
        <p className="text-xs text-[#4c739a] dark:text-slate-400">
          Used to calculate Day Works Sheet costs automatically in a future update. Leave blank to keep entering
          materials and labour manually, exactly as today.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {FIELDS.map((field) => (
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
          </div>
        ))}
      </div>
    </div>
  );
}
