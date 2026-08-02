"use client";

import { useState } from "react";
import type { ContractTerms, DayWorksRateType } from "@prisma/client";
import { rateForType, summariseLabourCost } from "@/lib/day-works-rates";

export type LabourRow = {
  workerName: string;
  date: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  hours: string; // kept as string while editing, parsed to number on save
  rateType: DayWorksRateType;
  taskDescription: string;
};

const RATE_TYPE_OPTIONS: { value: DayWorksRateType; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "night", label: "Night" },
  { value: "sunday_holiday", label: "Sunday / Public Holiday" }
];

function formatCurrency(amount: number) {
  return amount.toLocaleString("en-NZ", { style: "currency", currency: "NZD" });
}

export function DayWorksLabourReviewDialog({
  projectId,
  itemId,
  sheetId,
  initialEntries,
  warning,
  contractTerms,
  onClose,
  onSaved
}: {
  projectId: string;
  itemId: string;
  sheetId: string;
  initialEntries: LabourRow[];
  warning?: string | null;
  contractTerms: ContractTerms | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<LabourRow[]>(initialEntries);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateRow(index: number, field: keyof LabourRow, value: string) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_, i) => i !== index));
  }

  function addRow() {
    setRows((current) => [
      ...current,
      { workerName: "", date: current[0]?.date ?? new Date().toISOString().slice(0, 10), startTime: "", endTime: "", hours: "", rateType: "normal", taskDescription: "" }
    ]);
  }

  const validEntries = rows
    .map((row) => ({ ...row, hoursNum: Number(row.hours) }))
    .filter((row) => row.workerName.trim() && Number.isFinite(row.hoursNum) && row.hoursNum > 0);

  const summary = summariseLabourCost(
    validEntries.map((row) => ({ hours: row.hoursNum, rateType: row.rateType })),
    contractTerms
  );

  async function handleSave() {
    setError(null);
    const invalidRow = rows.find((row) => !row.workerName.trim() || !Number.isFinite(Number(row.hours)) || Number(row.hours) <= 0);
    if (invalidRow) {
      setError("Every entry needs a worker name and hours greater than 0. Remove any incomplete rows before saving.");
      return;
    }

    setIsSaving(true);
    const response = await fetch(
      `/api/projects/${projectId}/variation-items/${itemId}/day-works-sheets/${sheetId}/labour`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: rows.map((row) => ({
            workerName: row.workerName.trim(),
            date: row.date,
            startTime: row.startTime || null,
            endTime: row.endTime || null,
            hours: Number(row.hours),
            rateType: row.rateType,
            taskDescription: row.taskDescription.trim() || null
          }))
        })
      }
    );
    setIsSaving(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(typeof body?.error === "string" ? body.error : "Could not save labour entries.");
      return;
    }

    onSaved();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl rounded-xl bg-white dark:bg-slate-900 p-6 shadow-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold mb-1">Review labour entries</h2>
        <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-4">
          Extracted automatically from the uploaded sheet — review and correct anything before saving. Nothing is
          saved until you confirm.
        </p>

        {warning && (
          <p className="text-sm text-amber-600 dark:text-amber-400 mb-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 px-3 py-2">
            {warning}
          </p>
        )}

        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-xs min-w-[720px]">
            <thead>
              <tr className="text-left text-[#4c739a] dark:text-slate-400">
                <th className="px-1 pb-2 font-medium">Worker</th>
                <th className="px-1 pb-2 font-medium">Date</th>
                <th className="px-1 pb-2 font-medium">Start</th>
                <th className="px-1 pb-2 font-medium">End</th>
                <th className="px-1 pb-2 font-medium">Hours</th>
                <th className="px-1 pb-2 font-medium">Rate type</th>
                <th className="px-1 pb-2 font-medium">Task</th>
                <th className="px-1 pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-t border-[#e7edf3] dark:border-slate-800">
                  <td className="p-1">
                    <input
                      type="text"
                      value={row.workerName}
                      onChange={(event) => updateRow(index, "workerName", event.target.value)}
                      className="h-8 w-32 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2"
                    />
                  </td>
                  <td className="p-1">
                    <input
                      type="date"
                      value={row.date}
                      onChange={(event) => updateRow(index, "date", event.target.value)}
                      className="h-8 w-32 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-1"
                    />
                  </td>
                  <td className="p-1">
                    <input
                      type="text"
                      placeholder="HH:mm"
                      value={row.startTime}
                      onChange={(event) => updateRow(index, "startTime", event.target.value)}
                      className="h-8 w-16 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-1"
                    />
                  </td>
                  <td className="p-1">
                    <input
                      type="text"
                      placeholder="HH:mm"
                      value={row.endTime}
                      onChange={(event) => updateRow(index, "endTime", event.target.value)}
                      className="h-8 w-16 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-1"
                    />
                  </td>
                  <td className="p-1">
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      value={row.hours}
                      onChange={(event) => updateRow(index, "hours", event.target.value)}
                      className="h-8 w-16 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-1"
                    />
                  </td>
                  <td className="p-1">
                    <select
                      value={row.rateType}
                      onChange={(event) => updateRow(index, "rateType", event.target.value)}
                      className="h-8 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-1"
                    >
                      {RATE_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-1">
                    <input
                      type="text"
                      value={row.taskDescription}
                      onChange={(event) => updateRow(index, "taskDescription", event.target.value)}
                      className="h-8 w-32 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2"
                    />
                  </td>
                  <td className="p-1">
                    <button onClick={() => removeRow(index)} className="text-red-600 font-bold hover:underline">
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button onClick={addRow} className="mt-2 text-xs font-bold text-primary hover:underline">
          + Add entry
        </button>

        <div className="mt-4 pt-3 border-t border-[#e7edf3] dark:border-slate-800 text-sm">
          {summary.anyRateConfigured ? (
            <>
              <p className="font-bold">Labour total: {formatCurrency(summary.totalPricedCost)}</p>
              {RATE_TYPE_OPTIONS.filter((option) => summary.hoursByType[option.value] > 0).map((option) => {
                const rate = rateForType(contractTerms, option.value);
                return (
                  <p key={option.value} className="text-xs text-[#4c739a] dark:text-slate-400">
                    {option.label}: {summary.hoursByType[option.value].toFixed(2)} hrs
                    {rate != null ? ` @ ${formatCurrency(rate)}/hr` : " — rate not configured"}
                  </p>
                );
              })}
              {summary.unratedHours > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {summary.unratedHours.toFixed(2)} hrs not included in the total — configure the missing rate in
                  Settings.
                </p>
              )}
            </>
          ) : (
            <p className="text-[#4c739a] dark:text-slate-400">
              Total hours: {summary.totalHours.toFixed(2)} — configure Day Works rates in Settings to calculate a
              dollar total automatically.
            </p>
          )}
        </div>

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

        <div className="flex gap-3 justify-end mt-5">
          <button
            onClick={onClose}
            className="h-10 px-4 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save labour entries"}
          </button>
        </div>
      </div>
    </div>
  );
}
