"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ContractTerms, RetentionReleaseTrigger, RetentionTimingUnit, VariationScheduleType } from "@prisma/client";

type FieldKey =
  | "paymentClaimMethod"
  | "paymentClaimDay"
  | "variationNoticePeriodDays"
  | "variationNoticeMethod"
  | "delayNoticePeriodDays"
  | "delayNoticeMethod"
  | "retentionPercent"
  | "defectsLiabilityPeriodDays"
  | "disputeNoticeMethod"
  | "generalNoticeMethod";

const FIELDS: { key: FieldKey; label: string; type: "text" | "number"; suffix?: string }[] = [
  { key: "paymentClaimMethod", label: "Payment claim submission method", type: "text" },
  { key: "paymentClaimDay", label: "Payment claim due day of month", type: "number" },
  { key: "variationNoticePeriodDays", label: "Variation notice period", type: "number", suffix: "days" },
  { key: "variationNoticeMethod", label: "Variation notice method", type: "text" },
  { key: "delayNoticePeriodDays", label: "Delay / EOT notice period", type: "number", suffix: "days" },
  { key: "delayNoticeMethod", label: "Delay / EOT notice method", type: "text" },
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
  const [scheduleType, setScheduleType] = useState<VariationScheduleType | "">(
    contractTerms?.variationScheduleType ?? ""
  );
  const [scheduleValue, setScheduleValue] = useState(
    contractTerms?.variationScheduleValue != null ? String(contractTerms.variationScheduleValue) : ""
  );

  // Retention V2 — a bespoke block below (not the generic FIELDS array
  // above), same reasoning as the Variation/SI submission schedule block
  // just above: several of these fields (a trigger select, a timing-unit
  // select, an end-of-month-anchor checkbox) don't fit the generic text/
  // number input the FIELDS array renders.
  const [retentionApplies, setRetentionApplies] = useState<"" | "yes" | "no">(
    contractTerms?.retentionApplies == null ? "" : contractTerms.retentionApplies ? "yes" : "no"
  );
  const [retentionCapAmount, setRetentionCapAmount] = useState(
    contractTerms?.retentionCapAmount != null ? String(contractTerms.retentionCapAmount) : ""
  );
  const [initialReleasePercent, setInitialReleasePercent] = useState(
    contractTerms?.initialReleasePercent != null ? String(contractTerms.initialReleasePercent) : ""
  );
  const [initialReleaseTrigger, setInitialReleaseTrigger] = useState<RetentionReleaseTrigger | "">(
    contractTerms?.initialReleaseTrigger ?? ""
  );
  const [initialReleaseTimingDays, setInitialReleaseTimingDays] = useState(
    contractTerms?.initialReleaseTimingDays != null ? String(contractTerms.initialReleaseTimingDays) : ""
  );
  const [initialReleaseTimingUnit, setInitialReleaseTimingUnit] = useState<RetentionTimingUnit | "">(
    contractTerms?.initialReleaseTimingUnit ?? ""
  );
  const [initialReleaseAnchorEndOfMonth, setInitialReleaseAnchorEndOfMonth] = useState(
    contractTerms?.initialReleaseAnchorEndOfMonth ?? false
  );
  const [initialReleaseTimingDescription, setInitialReleaseTimingDescription] = useState(
    contractTerms?.initialReleaseTimingDescription ?? ""
  );
  const [finalReleasePercent, setFinalReleasePercent] = useState(
    contractTerms?.finalReleasePercent != null ? String(contractTerms.finalReleasePercent) : ""
  );
  const [finalReleaseTrigger, setFinalReleaseTrigger] = useState<RetentionReleaseTrigger | "">(
    contractTerms?.finalReleaseTrigger ?? ""
  );
  const [finalReleaseTimingDays, setFinalReleaseTimingDays] = useState(
    contractTerms?.finalReleaseTimingDays != null ? String(contractTerms.finalReleaseTimingDays) : ""
  );
  const [finalReleaseTimingUnit, setFinalReleaseTimingUnit] = useState<RetentionTimingUnit | "">(
    contractTerms?.finalReleaseTimingUnit ?? ""
  );
  const [finalReleaseAnchorEndOfMonth, setFinalReleaseAnchorEndOfMonth] = useState(
    contractTerms?.finalReleaseAnchorEndOfMonth ?? false
  );
  const [finalReleaseTimingDescription, setFinalReleaseTimingDescription] = useState(
    contractTerms?.finalReleaseTimingDescription ?? ""
  );
  const [retentionClauseReference, setRetentionClauseReference] = useState(contractTerms?.retentionClauseReference ?? "");

  const RETENTION_KEYS = [
    "retentionApplies",
    "retentionCapAmount",
    "initialReleasePercent",
    "initialReleaseTrigger",
    "initialReleaseTimingDays",
    "initialReleaseTimingUnit",
    "initialReleaseTimingDescription",
    "initialReleaseAnchorEndOfMonth",
    "finalReleasePercent",
    "finalReleaseTrigger",
    "finalReleaseTimingDays",
    "finalReleaseTimingUnit",
    "finalReleaseTimingDescription",
    "finalReleaseAnchorEndOfMonth",
    "retentionClauseReference"
  ] as const;
  const hasSuggestedRetention = RETENTION_KEYS.some(
    (key) => (contractTerms as unknown as Record<string, unknown> | null)?.[`suggested${key.charAt(0).toUpperCase()}${key.slice(1)}`] != null
  );

  async function saveRetention() {
    setIsSaving(true);
    await fetch(`/api/projects/${projectId}/contract-terms`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        retentionApplies: retentionApplies === "" ? null : retentionApplies === "yes",
        retentionCapAmount: retentionCapAmount === "" ? null : Number(retentionCapAmount),
        initialReleasePercent: initialReleasePercent === "" ? null : Number(initialReleasePercent),
        initialReleaseTrigger: initialReleaseTrigger || null,
        initialReleaseTimingDays: initialReleaseTimingDays === "" ? null : Number(initialReleaseTimingDays),
        initialReleaseTimingUnit: initialReleaseTimingUnit || null,
        initialReleaseTimingDescription: initialReleaseTimingDescription || null,
        initialReleaseAnchorEndOfMonth,
        finalReleasePercent: finalReleasePercent === "" ? null : Number(finalReleasePercent),
        finalReleaseTrigger: finalReleaseTrigger || null,
        finalReleaseTimingDays: finalReleaseTimingDays === "" ? null : Number(finalReleaseTimingDays),
        finalReleaseTimingUnit: finalReleaseTimingUnit || null,
        finalReleaseTimingDescription: finalReleaseTimingDescription || null,
        finalReleaseAnchorEndOfMonth,
        retentionClauseReference: retentionClauseReference || null
      })
    });
    setIsSaving(false);
    router.refresh();
  }

  async function confirmRetention() {
    if (!contractTerms) return;
    setRetentionApplies(contractTerms.suggestedRetentionApplies == null ? "" : contractTerms.suggestedRetentionApplies ? "yes" : "no");
    setRetentionCapAmount(contractTerms.suggestedRetentionCapAmount != null ? String(contractTerms.suggestedRetentionCapAmount) : "");
    setInitialReleasePercent(contractTerms.suggestedInitialReleasePercent != null ? String(contractTerms.suggestedInitialReleasePercent) : "");
    setInitialReleaseTrigger(contractTerms.suggestedInitialReleaseTrigger ?? "");
    setInitialReleaseTimingDays(
      contractTerms.suggestedInitialReleaseTimingDays != null ? String(contractTerms.suggestedInitialReleaseTimingDays) : ""
    );
    setInitialReleaseTimingUnit(contractTerms.suggestedInitialReleaseTimingUnit ?? "");
    setInitialReleaseTimingDescription(contractTerms.suggestedInitialReleaseTimingDescription ?? "");
    setInitialReleaseAnchorEndOfMonth(contractTerms.suggestedInitialReleaseAnchorEndOfMonth ?? false);
    setFinalReleasePercent(contractTerms.suggestedFinalReleasePercent != null ? String(contractTerms.suggestedFinalReleasePercent) : "");
    setFinalReleaseTrigger(contractTerms.suggestedFinalReleaseTrigger ?? "");
    setFinalReleaseTimingDays(
      contractTerms.suggestedFinalReleaseTimingDays != null ? String(contractTerms.suggestedFinalReleaseTimingDays) : ""
    );
    setFinalReleaseTimingUnit(contractTerms.suggestedFinalReleaseTimingUnit ?? "");
    setFinalReleaseTimingDescription(contractTerms.suggestedFinalReleaseTimingDescription ?? "");
    setFinalReleaseAnchorEndOfMonth(contractTerms.suggestedFinalReleaseAnchorEndOfMonth ?? false);
    setRetentionClauseReference(contractTerms.suggestedRetentionClauseReference ?? "");
    setIsSaving(true);
    await fetch(`/api/projects/${projectId}/contract-terms`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmFields: RETENTION_KEYS })
    });
    setIsSaving(false);
    router.refresh();
  }

  const suggestedFields = FIELDS.filter((field) => getSuggested(contractTerms, field.key) !== null);
  const suggestedScheduleType = contractTerms?.suggestedVariationScheduleType ?? null;
  const suggestedScheduleValue = contractTerms?.suggestedVariationScheduleValue ?? null;
  const hasSuggestedSchedule = suggestedScheduleType !== null && suggestedScheduleValue !== null;

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

  async function confirmFields(keys: string[]) {
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

  async function saveSchedule() {
    setIsSaving(true);
    await fetch(`/api/projects/${projectId}/contract-terms`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        variationScheduleType: scheduleType || null,
        variationScheduleValue: scheduleValue === "" ? null : Number(scheduleValue)
      })
    });
    setIsSaving(false);
    router.refresh();
  }

  async function confirmSchedule() {
    setScheduleType(suggestedScheduleType ?? "");
    setScheduleValue(suggestedScheduleValue != null ? String(suggestedScheduleValue) : "");
    setIsSaving(true);
    await fetch(`/api/projects/${projectId}/contract-terms`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmFields: ["variationScheduleType", "variationScheduleValue"] })
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

        <div className="flex flex-col gap-1 pt-2 border-t border-[#e7edf3] dark:border-slate-800">
          <label className="text-sm font-medium">Variation/SI submission schedule</label>
          <p className="text-xs text-[#4c739a] dark:text-slate-400">
            Drives the Variation Package scheduling automation (see the Automation setting below) — when in each
            month the contract requires variation/SI claims to be submitted by.
          </p>
          <div className="flex items-center gap-2">
            <select
              value={scheduleType}
              onChange={(event) => setScheduleType(event.target.value as VariationScheduleType | "")}
              onBlur={saveSchedule}
              className="h-9 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">Not set — manual entry</option>
              <option value="fixed_date">Fixed day of the month</option>
              <option value="working_days_before_month_end">N working days before month-end</option>
            </select>
            {scheduleType && (
              <input
                type="number"
                value={scheduleValue}
                onChange={(event) => setScheduleValue(event.target.value)}
                onBlur={saveSchedule}
                placeholder={scheduleType === "fixed_date" ? "Day of month (1-31)" : "Working days"}
                className="h-9 w-40 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            )}
          </div>
          {hasSuggestedSchedule && (
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">
                suggested:{" "}
                {suggestedScheduleType === "fixed_date"
                  ? `day ${suggestedScheduleValue} of the month`
                  : `${suggestedScheduleValue} working days before month-end`}
              </span>
              <button onClick={confirmSchedule} disabled={isSaving} className="text-primary font-bold hover:underline disabled:opacity-60">
                Confirm
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 pt-2 border-t border-[#e7edf3] dark:border-slate-800">
          <div className="flex items-center justify-between gap-3">
            <div>
              <label className="text-sm font-medium">Retention</label>
              <p className="text-xs text-[#4c739a] dark:text-slate-400">
                What your contract says about retention — rate, cap, and each release stage's trigger and timing. Drives the
                Retention tracker on the Payment Claims page.
              </p>
            </div>
            {hasSuggestedRetention && (
              <button
                onClick={confirmRetention}
                disabled={isSaving}
                className="h-8 px-3 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 disabled:opacity-60 shrink-0"
              >
                Confirm all suggested
              </button>
            )}
          </div>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Does retention apply?
            <select
              value={retentionApplies}
              onChange={(event) => setRetentionApplies(event.target.value as "" | "yes" | "no")}
              onBlur={saveRetention}
              className="h-9 w-48 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">Not yet determined</option>
              <option value="yes">Yes</option>
              <option value="no">No (e.g. bond in lieu of retention)</option>
            </select>
          </label>

          {retentionApplies !== "no" && (
            <>
              <label className="flex flex-col gap-1 text-sm font-medium w-64">
                Retention cap <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional, $)</span>
                <input
                  type="number"
                  value={retentionCapAmount}
                  onChange={(event) => setRetentionCapAmount(event.target.value)}
                  onBlur={saveRetention}
                  className="h-9 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </label>

              <div className="rounded-lg border border-[#e7edf3] dark:border-slate-700 p-3 flex flex-col gap-2">
                <p className="text-xs font-bold uppercase tracking-wide text-[#4c739a] dark:text-slate-400">Initial release</p>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="flex flex-col gap-1 text-xs font-medium w-24">
                    Share %
                    <input
                      type="number"
                      value={initialReleasePercent}
                      onChange={(event) => setInitialReleasePercent(event.target.value)}
                      onBlur={saveRetention}
                      className="h-9 rounded-md border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium flex-1 min-w-[14rem]">
                    Trigger
                    <select
                      value={initialReleaseTrigger}
                      onChange={(event) => setInitialReleaseTrigger(event.target.value as RetentionReleaseTrigger | "")}
                      onBlur={saveRetention}
                      className="h-9 rounded-md border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm"
                    >
                      <option value="">Not set</option>
                      <option value="completion_of_subcontract_works">Completion of the Subcontract Works</option>
                      <option value="practical_completion_subcontractor">Practical completion of your own scope</option>
                      <option value="final_payment_claim">Final payment claim</option>
                      <option value="final_account">Final account</option>
                      <option value="head_contract_event">Head contract event (not your own performance)</option>
                      <option value="other_event">Other event</option>
                      <option value="not_stated">Not stated in the contract</option>
                    </select>
                  </label>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="flex flex-col gap-1 text-xs font-medium w-20">
                    Timing
                    <input
                      type="number"
                      value={initialReleaseTimingDays}
                      onChange={(event) => setInitialReleaseTimingDays(event.target.value)}
                      onBlur={saveRetention}
                      className="h-9 rounded-md border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium w-40">
                    Unit
                    <select
                      value={initialReleaseTimingUnit}
                      onChange={(event) => setInitialReleaseTimingUnit(event.target.value as RetentionTimingUnit | "")}
                      onBlur={saveRetention}
                      className="h-9 rounded-md border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm"
                    >
                      <option value="">Not set</option>
                      <option value="working_days">Working days</option>
                      <option value="calendar_days">Calendar days</option>
                      <option value="weeks">Weeks</option>
                      <option value="months">Months</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium pb-2">
                    <input
                      type="checkbox"
                      checked={initialReleaseAnchorEndOfMonth}
                      onChange={(event) => {
                        setInitialReleaseAnchorEndOfMonth(event.target.checked);
                        void saveRetention();
                      }}
                      className="size-4"
                    />
                    Counted from end of month
                  </label>
                </div>
                <label className="flex flex-col gap-1 text-xs font-medium">
                  Description <span className="font-normal text-[#4c739a] dark:text-slate-400">(the contract's own wording)</span>
                  <input
                    type="text"
                    value={initialReleaseTimingDescription}
                    onChange={(event) => setInitialReleaseTimingDescription(event.target.value)}
                    onBlur={saveRetention}
                    className="h-9 rounded-md border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm"
                  />
                </label>
              </div>

              <div className="rounded-lg border border-[#e7edf3] dark:border-slate-700 p-3 flex flex-col gap-2">
                <p className="text-xs font-bold uppercase tracking-wide text-[#4c739a] dark:text-slate-400">Final release</p>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="flex flex-col gap-1 text-xs font-medium w-24">
                    Share %
                    <input
                      type="number"
                      value={finalReleasePercent}
                      onChange={(event) => setFinalReleasePercent(event.target.value)}
                      onBlur={saveRetention}
                      className="h-9 rounded-md border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium flex-1 min-w-[14rem]">
                    Trigger
                    <select
                      value={finalReleaseTrigger}
                      onChange={(event) => setFinalReleaseTrigger(event.target.value as RetentionReleaseTrigger | "")}
                      onBlur={saveRetention}
                      className="h-9 rounded-md border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm"
                    >
                      <option value="">Not set</option>
                      <option value="completion_of_subcontract_works">Completion of the Subcontract Works</option>
                      <option value="practical_completion_subcontractor">Practical completion of your own scope</option>
                      <option value="final_payment_claim">Final payment claim</option>
                      <option value="final_account">Final account</option>
                      <option value="head_contract_event">Head contract event (not your own performance)</option>
                      <option value="other_event">Other event</option>
                      <option value="not_stated">Not stated in the contract</option>
                    </select>
                  </label>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="flex flex-col gap-1 text-xs font-medium w-20">
                    Timing
                    <input
                      type="number"
                      value={finalReleaseTimingDays}
                      onChange={(event) => setFinalReleaseTimingDays(event.target.value)}
                      onBlur={saveRetention}
                      className="h-9 rounded-md border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium w-40">
                    Unit
                    <select
                      value={finalReleaseTimingUnit}
                      onChange={(event) => setFinalReleaseTimingUnit(event.target.value as RetentionTimingUnit | "")}
                      onBlur={saveRetention}
                      className="h-9 rounded-md border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm"
                    >
                      <option value="">Not set</option>
                      <option value="working_days">Working days</option>
                      <option value="calendar_days">Calendar days</option>
                      <option value="weeks">Weeks</option>
                      <option value="months">Months</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium pb-2">
                    <input
                      type="checkbox"
                      checked={finalReleaseAnchorEndOfMonth}
                      onChange={(event) => {
                        setFinalReleaseAnchorEndOfMonth(event.target.checked);
                        void saveRetention();
                      }}
                      className="size-4"
                    />
                    Counted from end of month
                  </label>
                </div>
                <label className="flex flex-col gap-1 text-xs font-medium">
                  Description <span className="font-normal text-[#4c739a] dark:text-slate-400">(the contract's own wording)</span>
                  <input
                    type="text"
                    value={finalReleaseTimingDescription}
                    onChange={(event) => setFinalReleaseTimingDescription(event.target.value)}
                    onBlur={saveRetention}
                    className="h-9 rounded-md border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm"
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Clause reference <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span>
                <input
                  type="text"
                  value={retentionClauseReference}
                  onChange={(event) => setRetentionClauseReference(event.target.value)}
                  onBlur={saveRetention}
                  placeholder="e.g. Clause 12.4, 10.4.2(a)"
                  className="h-9 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </label>

              {contractTerms?.retentionRequiresReview && (
                <p className="text-xs rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 p-2">
                  This provision may require review under the Construction Contracts Act 2002 — see below.
                  {contractTerms.retentionReviewNotes && <span className="block mt-1">{contractTerms.retentionReviewNotes}</span>}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
