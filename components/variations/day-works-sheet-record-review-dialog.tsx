"use client";

import { Fragment, useState } from "react";
import type { DayWorksSheetRecord } from "@prisma/client";
import { computeSheetRecordTotal } from "@/lib/variation-package";
import type { DraftSheetRecord } from "@/lib/day-works-sheet-extraction-types";

// Reasonable-uncertainty threshold below which a row gets flagged for
// extra scrutiny in the review UI (Task 4) — rows are never blocked from
// editing or saving regardless of confidence, this is purely a visual
// prioritisation aid. undefined/null confidence (e.g. a manually-edited
// saved record reopened via "Edit summary") is never flagged — there's no
// AI confidence signal to distrust for those.
const LOW_CONFIDENCE_THRESHOLD = 0.6;

export type SheetRecordRow = {
  sheetNumber: string;
  teamLeaderCount: string;
  teamMemberCount: string;
  totalHours: string;
  ratePerHour: string;
  date: string; // YYYY-MM-DD
  startTime: string;
  finishTime: string;
  task: string;
  notes: string;
  weather: string;
  location: string;
  confidence: number | null;
};

// ratePerHour defaults to "" (unchanged behaviour) unless a caller passes
// the project's configured Normal-hours rate — see DayWorksSheetRecordReviewDialog's
// defaultRatePerHour prop and this feature's task notes.
export function emptySheetRecordRow(sheetNumber: string, ratePerHour = ""): SheetRecordRow {
  return {
    sheetNumber,
    teamLeaderCount: "",
    teamMemberCount: "",
    totalHours: "",
    ratePerHour,
    date: "",
    startTime: "",
    finishTime: "",
    task: "",
    notes: "",
    weather: "",
    location: "",
    confidence: null
  };
}

// Relocated here from the old variation-day-works-section.tsx (Labour,
// Plant & Material AI Extraction) so both the per-sheet re-extract flow
// on this dialog's own callers AND components/day-works/use-as-day-works-sheet-action.tsx
// share one implementation, not two copies.
export function draftRecordsToRows(records: DraftSheetRecord[], defaultRatePerHour: string): SheetRecordRow[] {
  if (records.length === 0) return [emptySheetRecordRow("Sheet 1", defaultRatePerHour)];
  return records.map((record) => ({
    sheetNumber: record.sheetNumber,
    teamLeaderCount: String(record.teamLeaderCount),
    teamMemberCount: String(record.teamMemberCount),
    totalHours: record.totalHours != null ? String(record.totalHours) : "",
    ratePerHour: defaultRatePerHour,
    date: record.date ?? "",
    startTime: record.startTime ?? "",
    finishTime: record.finishTime ?? "",
    task: record.task ?? "",
    notes: record.notes ?? "",
    weather: record.weather ?? "",
    location: record.location ?? "",
    confidence: record.confidence
  }));
}

// Also relocated here from the old variation-day-works-section.tsx —
// reopening an already-saved (and therefore already human-reviewed)
// sheet via "Edit summary" carries no AI confidence signal, so
// confidence: null throughout means the review dialog never flags these
// rows as low-confidence.
export function savedRecordsToRows(records: DayWorksSheetRecord[]): SheetRecordRow[] {
  return records.map((record) => ({
    sheetNumber: record.sheetNumber,
    teamLeaderCount: String(record.teamLeaderCount),
    teamMemberCount: String(record.teamMemberCount),
    totalHours: record.totalHours != null ? String(Number(record.totalHours)) : "",
    ratePerHour: record.ratePerHour != null ? String(Number(record.ratePerHour)) : "",
    date: record.date ? new Date(record.date).toISOString().slice(0, 10) : "",
    startTime: record.startTime ?? "",
    finishTime: record.finishTime ?? "",
    task: record.task ?? "",
    notes: record.notes ?? "",
    weather: record.weather ?? "",
    location: record.location ?? "",
    confidence: null
  }));
}

function formatCurrency(amount: number) {
  return amount.toLocaleString("en-NZ", { style: "currency", currency: "NZD" });
}

function rowTotal(row: SheetRecordRow): number | null {
  return computeSheetRecordTotal(row.totalHours, row.ratePerHour);
}

// Reviews AI-extracted per-SHEET summaries, not per-worker timesheet
// entries — a deliberate simplification (see this feature's task notes).
// No hard validation blocks saving here on purpose: this is a
// low-friction review step, every field bar the row itself is optional,
// and Rate is always a plain number input, never a rate-type dropdown.
export function DayWorksSheetRecordReviewDialog({
  projectId,
  itemId,
  sheetId,
  initialRows,
  warning,
  defaultRatePerHour,
  onClose,
  onSaved
}: {
  projectId: string;
  itemId: string;
  sheetId: string;
  initialRows: SheetRecordRow[];
  warning?: string | null;
  // The project's configured Normal-hours Day Works rate (Project
  // Settings), pre-filled on a manually-added row — most sheets are
  // standard hours, so this saves re-typing the same rate on every sheet
  // while staying a plain, freely-editable default (Task 1.2/1.4).
  defaultRatePerHour?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<SheetRecordRow[]>(initialRows);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateRow(index: number, field: keyof SheetRecordRow, value: string) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_, i) => i !== index));
    setExpandedIndex((current) => (current === index ? null : current));
  }

  function addRow() {
    setRows((current) => [...current, emptySheetRecordRow(`Sheet ${current.length + 1}`, defaultRatePerHour)]);
  }

  const grandTotal = rows.reduce((sum, row) => sum + (rowTotal(row) ?? 0), 0);

  async function handleSave() {
    setError(null);
    setIsSaving(true);
    const response = await fetch(
      `/api/projects/${projectId}/variation-items/${itemId}/day-works-sheets/${sheetId}/sheet-records`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          records: rows.map((row) => ({
            sheetNumber: row.sheetNumber || null,
            teamLeaderCount: row.teamLeaderCount || null,
            teamMemberCount: row.teamMemberCount || null,
            totalHours: row.totalHours || null,
            ratePerHour: row.ratePerHour || null,
            date: row.date || null,
            startTime: row.startTime || null,
            finishTime: row.finishTime || null,
            task: row.task || null,
            notes: row.notes || null,
            weather: row.weather || null,
            location: row.location || null
          }))
        })
      }
    );
    setIsSaving(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(typeof body?.error === "string" ? body.error : "Could not save this dayworks summary.");
      return;
    }

    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="relative w-full max-w-4xl rounded-xl bg-white dark:bg-slate-900 p-6 shadow-lg max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 rounded-lg p-1 text-[#4c739a] hover:bg-[#e7edf3] dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>
        <h2 className="text-lg font-bold mb-1">Review Dayworks Summary</h2>
        <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-4">
          Extracted automatically from the uploaded sheet(s) — one row per physical day works sheet detected. Review
          and correct anything, enter a rate, and add any sheets that were missed before saving.
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
                <th className="px-1 pb-2 font-medium">Sheet No</th>
                <th className="px-1 pb-2 font-medium">Team Leader</th>
                <th className="px-1 pb-2 font-medium">Team Members</th>
                <th className="px-1 pb-2 font-medium">Hours</th>
                <th className="px-1 pb-2 font-medium">Rate ($/hr)</th>
                <th className="px-1 pb-2 font-medium">Total</th>
                <th className="px-1 pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const total = rowTotal(row);
                const isExpanded = expandedIndex === index;
                const isLowConfidence = row.confidence != null && row.confidence < LOW_CONFIDENCE_THRESHOLD;
                return (
                  <Fragment key={index}>
                    <tr
                      className={`border-t border-[#e7edf3] dark:border-slate-800 ${
                        isLowConfidence ? "bg-amber-50 dark:bg-amber-900/20" : ""
                      }`}
                    >
                      <td className="p-1">
                        <div className="flex items-center gap-1">
                          {isLowConfidence && (
                            <span
                              className="material-symbols-outlined text-base text-amber-600 dark:text-amber-400 shrink-0"
                              title={row.notes || "Low-confidence extraction — please double-check this row."}
                            >
                              warning
                            </span>
                          )}
                          <input
                            type="text"
                            value={row.sheetNumber}
                            onChange={(event) => updateRow(index, "sheetNumber", event.target.value)}
                            className="h-8 w-24 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2"
                          />
                        </div>
                      </td>
                      <td className="p-1">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={row.teamLeaderCount}
                          onChange={(event) => updateRow(index, "teamLeaderCount", event.target.value)}
                          className="h-8 w-16 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-1"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={row.teamMemberCount}
                          onChange={(event) => updateRow(index, "teamMemberCount", event.target.value)}
                          className="h-8 w-16 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-1"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="number"
                          min="0"
                          step="0.25"
                          value={row.totalHours}
                          onChange={(event) => updateRow(index, "totalHours", event.target.value)}
                          className="h-8 w-20 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-1"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.ratePerHour}
                          onChange={(event) => updateRow(index, "ratePerHour", event.target.value)}
                          className="h-8 w-24 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-1"
                        />
                      </td>
                      <td className="p-1 font-bold whitespace-nowrap">{total != null ? formatCurrency(total) : "—"}</td>
                      <td className="p-1 whitespace-nowrap">
                        <button
                          onClick={() => setExpandedIndex(isExpanded ? null : index)}
                          className="text-primary font-bold hover:underline mr-2"
                        >
                          {isExpanded ? "Hide details" : "Details"}
                        </button>
                        <button onClick={() => removeRow(index)} className="text-red-600 font-bold hover:underline">
                          Remove
                        </button>
                      </td>
                    </tr>
                    {isLowConfidence && row.notes && (
                      <tr className="bg-amber-50 dark:bg-amber-900/20">
                        <td colSpan={7} className="px-2 pb-2 text-[11px] text-amber-700 dark:text-amber-400">
                          {row.notes}
                        </td>
                      </tr>
                    )}
                    {isExpanded && (
                      <tr className="bg-slate-50 dark:bg-slate-800/40">
                        <td colSpan={7} className="p-3">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-[#4c739a] dark:text-slate-400 mb-2">
                            Additional Details (optional)
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <label className="flex flex-col gap-1">
                              Date
                              <input
                                type="date"
                                value={row.date}
                                onChange={(event) => updateRow(index, "date", event.target.value)}
                                className="h-8 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2"
                              />
                            </label>
                            <label className="flex flex-col gap-1">
                              Start time
                              <input
                                type="text"
                                placeholder="HH:mm"
                                value={row.startTime}
                                onChange={(event) => updateRow(index, "startTime", event.target.value)}
                                className="h-8 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2"
                              />
                            </label>
                            <label className="flex flex-col gap-1">
                              Finish time
                              <input
                                type="text"
                                placeholder="HH:mm"
                                value={row.finishTime}
                                onChange={(event) => updateRow(index, "finishTime", event.target.value)}
                                className="h-8 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2"
                              />
                            </label>
                            <label className="flex flex-col gap-1">
                              Weather
                              <input
                                type="text"
                                value={row.weather}
                                onChange={(event) => updateRow(index, "weather", event.target.value)}
                                className="h-8 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2"
                              />
                            </label>
                            <label className="flex flex-col gap-1">
                              Location
                              <input
                                type="text"
                                value={row.location}
                                onChange={(event) => updateRow(index, "location", event.target.value)}
                                className="h-8 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2"
                              />
                            </label>
                            <label className="flex flex-col gap-1 col-span-2">
                              Task
                              <input
                                type="text"
                                value={row.task}
                                onChange={(event) => updateRow(index, "task", event.target.value)}
                                className="h-8 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2"
                              />
                            </label>
                            <label className="flex flex-col gap-1 col-span-2">
                              Notes
                              <input
                                type="text"
                                value={row.notes}
                                onChange={(event) => updateRow(index, "notes", event.target.value)}
                                className="h-8 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2"
                              />
                            </label>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <button onClick={addRow} className="mt-2 text-xs font-bold text-primary hover:underline">
          + Add sheet
        </button>

        <div className="mt-4 pt-3 border-t border-[#e7edf3] dark:border-slate-800 text-sm">
          <p className="font-bold">Grand total: {formatCurrency(grandTotal)}</p>
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
            {isSaving ? "Saving..." : "Save Dayworks Summary"}
          </button>
        </div>
      </div>
    </div>
  );
}
