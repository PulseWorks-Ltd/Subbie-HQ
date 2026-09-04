"use client";

import { useState } from "react";
import type { ContractTerms } from "@prisma/client";
import { computeSheetRecordTotal } from "@/lib/variation-package";
import {
  emptySheetRecordRow,
  draftRecordsToRows,
  type SheetRecordRow
} from "@/components/variations/day-works-sheet-record-review-dialog";
import type { ClassifiedFileResult } from "@/lib/labour-plant-material-classification-types";
import type { ExtractedLineItem } from "@/lib/grok";

// Below this, a file's classification isn't trusted enough to auto-route
// it into a section — it goes to "Needs review" instead (Task 5) rather
// than risk silently filing a document under the wrong type. Matches
// DOCUMENT_CLASSIFICATION_CONFIDENCE_THRESHOLD in lib/grok.ts — kept as
// its own constant here (not imported) since that constant lives in a
// server-only module this client component can't import from.
const CONFIDENCE_THRESHOLD = 0.6;
const LOW_CONFIDENCE_THRESHOLD = 0.6;

function formatCurrency(amount: number) {
  return amount.toLocaleString("en-NZ", { style: "currency", currency: "NZD" });
}

type SheetGroup = {
  fileName: string;
  storageKey: string;
  contentType: string;
  rows: SheetRecordRow[];
};

type LineItemRow = {
  description: string;
  quantity: string;
  unit: string;
  unitCost: string;
  sourceFileName: string;
  sourceStorageKey: string;
  sourceContentType: string;
};

type UnresolvedFile = {
  fileName: string;
  storageKey: string;
  contentType: string;
  error: string | null;
  classificationConfidence: number;
};

function lineItemToRow(item: ExtractedLineItem, file: ClassifiedFileResult): LineItemRow {
  return {
    description: item.description,
    quantity: item.quantity != null ? String(item.quantity) : "",
    unit: item.unit ?? "",
    unitCost: item.unitCost != null ? String(item.unitCost) : "",
    sourceFileName: file.fileName,
    sourceStorageKey: file.storageKey,
    sourceContentType: file.contentType
  };
}

function emptyLineItemRow(file: { fileName: string; storageKey: string; contentType: string }): LineItemRow {
  return {
    description: "",
    quantity: "",
    unit: "",
    unitCost: "",
    sourceFileName: file.fileName,
    sourceStorageKey: file.storageKey,
    sourceContentType: file.contentType
  };
}

type ReviewState = {
  sheetGroups: SheetGroup[];
  materialsRows: LineItemRow[];
  plantRows: LineItemRow[];
  unresolved: UnresolvedFile[];
};

// Routes each classified file (Task 4/5) into the section its
// classification earned — confidently classified files (including a
// confident classification that happened to extract zero line items, e.g.
// a blank invoice template) land pre-filled or as one empty draft row;
// anything unclassified, low-confidence, or errored goes to "Needs
// review" so the user assigns a type manually rather than data silently
// landing in the wrong section.
function buildInitialState(files: ClassifiedFileResult[], defaultRatePerHour: string): ReviewState {
  const sheetGroups: SheetGroup[] = [];
  const materialsRows: LineItemRow[] = [];
  const plantRows: LineItemRow[] = [];
  const unresolved: UnresolvedFile[] = [];

  for (const file of files) {
    const isConfident =
      !file.error && file.documentType !== "unknown" && file.classificationConfidence >= CONFIDENCE_THRESHOLD;

    if (!isConfident) {
      unresolved.push({
        fileName: file.fileName,
        storageKey: file.storageKey,
        contentType: file.contentType,
        error: file.error,
        classificationConfidence: file.classificationConfidence
      });
      continue;
    }

    if (file.documentType === "day_works_sheet") {
      sheetGroups.push({
        fileName: file.fileName,
        storageKey: file.storageKey,
        contentType: file.contentType,
        rows: draftRecordsToRows(file.dayWorksSheets, defaultRatePerHour)
      });
    } else if (file.documentType === "materials_invoice") {
      materialsRows.push(
        ...(file.materialsLineItems.length > 0 ? file.materialsLineItems.map((li) => lineItemToRow(li, file)) : [emptyLineItemRow(file)])
      );
    } else if (file.documentType === "plant_docket") {
      plantRows.push(
        ...(file.plantLineItems.length > 0 ? file.plantLineItems.map((li) => lineItemToRow(li, file)) : [emptyLineItemRow(file)])
      );
    }
  }

  return { sheetGroups, materialsRows, plantRows, unresolved };
}

function LineItemTable({
  title,
  rows,
  onUpdate,
  onRemove,
  onAdd,
  unitPlaceholder
}: {
  title: string;
  rows: LineItemRow[];
  onUpdate: (index: number, field: keyof LineItemRow, value: string) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  unitPlaceholder: string;
}) {
  const total = rows.reduce((sum, row) => sum + (Number(row.quantity) || 0) * (Number(row.unitCost) || 0), 0);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold">
          {title} ({rows.length})
        </h3>
        <span className="text-xs font-bold text-[#4c739a] dark:text-slate-400">{formatCurrency(total)}</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-[#4c739a] dark:text-slate-400 mb-2">None in this batch.</p>
      ) : (
        <div className="overflow-x-auto -mx-1 mb-2">
          <table className="w-full text-xs min-w-[600px]">
            <thead>
              <tr className="text-left text-[#4c739a] dark:text-slate-400">
                <th className="px-1 pb-2 font-medium">Description</th>
                <th className="px-1 pb-2 font-medium w-20">Qty</th>
                <th className="px-1 pb-2 font-medium w-24">Unit</th>
                <th className="px-1 pb-2 font-medium w-28">Unit Cost</th>
                <th className="px-1 pb-2 font-medium w-24">Total</th>
                <th className="px-1 pb-2 font-medium">Source</th>
                <th className="px-1 pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-t border-[#e7edf3] dark:border-slate-800">
                  <td className="p-1">
                    <input
                      type="text"
                      value={row.description}
                      onChange={(event) => onUpdate(index, "description", event.target.value)}
                      className="h-8 w-full rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2"
                    />
                  </td>
                  <td className="p-1">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.quantity}
                      onChange={(event) => onUpdate(index, "quantity", event.target.value)}
                      className="h-8 w-20 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-1"
                    />
                  </td>
                  <td className="p-1">
                    <input
                      type="text"
                      placeholder={unitPlaceholder}
                      value={row.unit}
                      onChange={(event) => onUpdate(index, "unit", event.target.value)}
                      className="h-8 w-24 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-1"
                    />
                  </td>
                  <td className="p-1">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.unitCost}
                      onChange={(event) => onUpdate(index, "unitCost", event.target.value)}
                      className="h-8 w-28 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-1"
                    />
                  </td>
                  <td className="p-1 font-bold whitespace-nowrap">
                    {formatCurrency((Number(row.quantity) || 0) * (Number(row.unitCost) || 0))}
                  </td>
                  <td className="p-1 truncate max-w-[140px] text-[#4c739a] dark:text-slate-400" title={row.sourceFileName}>
                    {row.sourceFileName || "—"}
                  </td>
                  <td className="p-1 whitespace-nowrap">
                    <button onClick={() => onRemove(index)} className="text-red-600 font-bold hover:underline">
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <button onClick={onAdd} className="text-xs font-bold text-primary hover:underline">
        + Add {title.toLowerCase()} line
      </button>
    </div>
  );
}

// Unified review-before-save surface (Task 6) for a just-classified batch
// of files (Task 3/4) — Day Works / Materials / Plant, each independently
// editable, plus a "Needs review" section (Task 5) for anything the AI
// couldn't confidently classify, where the user assigns a type and
// proceeds straight to manual entry for that file (no automatic second
// AI attempt — see this feature's task notes on that judgement call).
// Nothing is saved until "Save" is clicked, matching the existing Day
// Works review dialog's discipline exactly.
export function LabourPlantMaterialReviewDialog({
  projectId,
  itemId,
  files,
  defaultRatePerHour,
  contractTerms,
  onClose,
  onSaved
}: {
  projectId: string;
  itemId: string;
  files: ClassifiedFileResult[];
  defaultRatePerHour: string;
  contractTerms: ContractTerms | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [state, setState] = useState<ReviewState>(() => buildInitialState(files, defaultRatePerHour));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateSheetRow(groupIndex: number, rowIndex: number, field: keyof SheetRecordRow, value: string) {
    setState((current) => ({
      ...current,
      sheetGroups: current.sheetGroups.map((group, gi) =>
        gi !== groupIndex
          ? group
          : { ...group, rows: group.rows.map((row, ri) => (ri === rowIndex ? { ...row, [field]: value } : row)) }
      )
    }));
  }

  function removeSheetRow(groupIndex: number, rowIndex: number) {
    setState((current) => ({
      ...current,
      sheetGroups: current.sheetGroups.map((group, gi) =>
        gi !== groupIndex ? group : { ...group, rows: group.rows.filter((_, ri) => ri !== rowIndex) }
      )
    }));
  }

  function addSheetRow(groupIndex: number) {
    setState((current) => ({
      ...current,
      sheetGroups: current.sheetGroups.map((group, gi) =>
        gi !== groupIndex
          ? group
          : { ...group, rows: [...group.rows, emptySheetRecordRow(`Sheet ${group.rows.length + 1}`, defaultRatePerHour)] }
      )
    }));
  }

  function removeSheetGroup(groupIndex: number) {
    setState((current) => ({ ...current, sheetGroups: current.sheetGroups.filter((_, gi) => gi !== groupIndex) }));
  }

  function updateLineItem(list: "materialsRows" | "plantRows", index: number, field: keyof LineItemRow, value: string) {
    setState((current) => ({
      ...current,
      [list]: current[list].map((row, i) => (i === index ? { ...row, [field]: value } : row))
    }));
  }

  function removeLineItem(list: "materialsRows" | "plantRows", index: number) {
    setState((current) => ({ ...current, [list]: current[list].filter((_, i) => i !== index) }));
  }

  function addLineItem(list: "materialsRows" | "plantRows") {
    setState((current) => ({
      ...current,
      [list]: [...current[list], emptyLineItemRow({ fileName: "", storageKey: "", contentType: "" })]
    }));
  }

  function resolveFile(file: UnresolvedFile, type: "day_works_sheet" | "materials" | "plant") {
    setState((current) => {
      const unresolved = current.unresolved.filter((f) => f.storageKey !== file.storageKey);
      if (type === "day_works_sheet") {
        return {
          ...current,
          unresolved,
          sheetGroups: [
            ...current.sheetGroups,
            { fileName: file.fileName, storageKey: file.storageKey, contentType: file.contentType, rows: [emptySheetRecordRow("Sheet 1", defaultRatePerHour)] }
          ]
        };
      }
      if (type === "materials") {
        return { ...current, unresolved, materialsRows: [...current.materialsRows, emptyLineItemRow(file)] };
      }
      return { ...current, unresolved, plantRows: [...current.plantRows, emptyLineItemRow(file)] };
    });
  }

  // Live combined total (Task 6.1) — computed directly against the
  // current DRAFT (string-valued) rows so it updates as the user edits,
  // before anything is saved. Uses computeSheetRecordTotal (accepts loose
  // string|number|Decimal|null input by design) for labour, the same
  // formula lib/variation-package.ts's real Prisma-backed helpers use —
  // just applied here to draft rows rather than saved database rows,
  // since there's no live Prisma record for something not yet persisted.
  const labourTotal = state.sheetGroups.reduce(
    (sum, group) => sum + group.rows.reduce((rowSum, row) => rowSum + (computeSheetRecordTotal(row.totalHours, row.ratePerHour) ?? 0), 0),
    0
  );
  const materialsCost = state.materialsRows.reduce((sum, row) => sum + (Number(row.quantity) || 0) * (Number(row.unitCost) || 0), 0);
  const markupPercent = contractTerms?.materialsMarkupPercent ?? null;
  const materialsMarkupAmount = markupPercent != null ? materialsCost * (markupPercent / 100) : 0;
  const plantCost = state.plantRows.reduce((sum, row) => sum + (Number(row.quantity) || 0) * (Number(row.unitCost) || 0), 0);
  const grandTotal = labourTotal + materialsCost + materialsMarkupAmount + plantCost;

  async function handleSave() {
    setError(null);
    setIsSaving(true);

    const response = await fetch(`/api/projects/${projectId}/variation-items/${itemId}/labour-plant-material/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dayWorksSheets: state.sheetGroups.map((group) => ({
          fileName: group.fileName,
          storageKey: group.storageKey,
          contentType: group.contentType,
          records: group.rows.map((row) => ({
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
        })),
        materials: state.materialsRows.map((row) => ({
          description: row.description || null,
          quantity: row.quantity || null,
          unit: row.unit || null,
          unitCost: row.unitCost || null,
          sourceFileName: row.sourceFileName || null,
          sourceStorageKey: row.sourceStorageKey || null,
          sourceContentType: row.sourceContentType || null
        })),
        plant: state.plantRows.map((row) => ({
          description: row.description || null,
          quantity: row.quantity || null,
          unit: row.unit || null,
          unitCost: row.unitCost || null,
          sourceFileName: row.sourceFileName || null,
          sourceStorageKey: row.sourceStorageKey || null,
          sourceContentType: row.sourceContentType || null
        }))
      })
    });
    setIsSaving(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(typeof body?.error === "string" ? body.error : "Could not save this batch.");
      return;
    }

    onSaved();
  }

  const hasNothingToSave =
    state.sheetGroups.every((g) => g.rows.length === 0) && state.materialsRows.length === 0 && state.plantRows.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="relative w-full max-w-5xl rounded-xl bg-white dark:bg-slate-900 p-6 shadow-lg max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 rounded-lg p-1 text-[#4c739a] hover:bg-[#e7edf3] dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>
        <h2 className="text-lg font-bold mb-1">Review Labour, Materials &amp; Plant</h2>
        <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-4">
          Each file below was classified and read automatically. Review and correct anything before saving — nothing
          is added to this item until you confirm.
        </p>

        {state.unresolved.length > 0 && (
          <div className="mb-6 rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/20 p-4">
            <p className="text-sm font-bold mb-2">Needs review ({state.unresolved.length})</p>
            <p className="text-xs text-[#4c739a] dark:text-slate-400 mb-3">
              These files couldn&apos;t be confidently classified. Choose what each one is — it'll move into the
              matching section below for manual entry.
            </p>
            <div className="flex flex-col gap-2">
              {state.unresolved.map((file) => (
                <div key={file.storageKey} className="flex items-center justify-between gap-3 text-xs bg-white dark:bg-slate-900 rounded-lg border border-[#e7edf3] dark:border-slate-800 p-2">
                  <div className="min-w-0">
                    <p className="font-bold truncate">{file.fileName}</p>
                    <p className="text-[#4c739a] dark:text-slate-400">
                      {file.error ?? `Low classification confidence (${Math.round(file.classificationConfidence * 100)}%)`}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => resolveFile(file, "day_works_sheet")}
                      className="h-8 px-2 rounded-lg border border-[#e7edf3] dark:border-slate-700 font-bold hover:bg-[#e7edf3] dark:hover:bg-slate-800"
                    >
                      Day Works Sheet
                    </button>
                    <button
                      onClick={() => resolveFile(file, "materials")}
                      className="h-8 px-2 rounded-lg border border-[#e7edf3] dark:border-slate-700 font-bold hover:bg-[#e7edf3] dark:hover:bg-slate-800"
                    >
                      Materials
                    </button>
                    <button
                      onClick={() => resolveFile(file, "plant")}
                      className="h-8 px-2 rounded-lg border border-[#e7edf3] dark:border-slate-700 font-bold hover:bg-[#e7edf3] dark:hover:bg-slate-800"
                    >
                      Plant
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-6">
          <h3 className="text-sm font-bold mb-2">Day Works Sheets ({state.sheetGroups.length})</h3>
          {state.sheetGroups.length === 0 ? (
            <p className="text-xs text-[#4c739a] dark:text-slate-400">None in this batch.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {state.sheetGroups.map((group, groupIndex) => (
                <div key={groupIndex} className="rounded-lg border border-[#e7edf3] dark:border-slate-800 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold truncate">{group.fileName}</p>
                    <button onClick={() => removeSheetGroup(groupIndex)} className="text-xs text-red-600 font-bold hover:underline shrink-0">
                      Remove file
                    </button>
                  </div>
                  <div className="overflow-x-auto -mx-1">
                    <table className="w-full text-xs min-w-[560px]">
                      <thead>
                        <tr className="text-left text-[#4c739a] dark:text-slate-400">
                          <th className="px-1 pb-2 font-medium">Sheet No</th>
                          <th className="px-1 pb-2 font-medium">Leaders</th>
                          <th className="px-1 pb-2 font-medium">Members</th>
                          <th className="px-1 pb-2 font-medium">Hours</th>
                          <th className="px-1 pb-2 font-medium">Rate ($/hr)</th>
                          <th className="px-1 pb-2 font-medium">Total</th>
                          <th className="px-1 pb-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.rows.map((row, rowIndex) => {
                          const total = computeSheetRecordTotal(row.totalHours, row.ratePerHour);
                          const isLowConfidence = row.confidence != null && row.confidence < LOW_CONFIDENCE_THRESHOLD;
                          return (
                            <tr
                              key={rowIndex}
                              className={`border-t border-[#e7edf3] dark:border-slate-800 ${isLowConfidence ? "bg-amber-50 dark:bg-amber-900/20" : ""}`}
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
                                    onChange={(event) => updateSheetRow(groupIndex, rowIndex, "sheetNumber", event.target.value)}
                                    className="h-8 w-20 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2"
                                  />
                                </div>
                              </td>
                              <td className="p-1">
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={row.teamLeaderCount}
                                  onChange={(event) => updateSheetRow(groupIndex, rowIndex, "teamLeaderCount", event.target.value)}
                                  className="h-8 w-16 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-1"
                                />
                              </td>
                              <td className="p-1">
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={row.teamMemberCount}
                                  onChange={(event) => updateSheetRow(groupIndex, rowIndex, "teamMemberCount", event.target.value)}
                                  className="h-8 w-16 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-1"
                                />
                              </td>
                              <td className="p-1">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.25"
                                  value={row.totalHours}
                                  onChange={(event) => updateSheetRow(groupIndex, rowIndex, "totalHours", event.target.value)}
                                  className="h-8 w-20 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-1"
                                />
                              </td>
                              <td className="p-1">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={row.ratePerHour}
                                  onChange={(event) => updateSheetRow(groupIndex, rowIndex, "ratePerHour", event.target.value)}
                                  className="h-8 w-24 rounded border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-1"
                                />
                              </td>
                              <td className="p-1 font-bold whitespace-nowrap">{total != null ? formatCurrency(total) : "—"}</td>
                              <td className="p-1 whitespace-nowrap">
                                <button onClick={() => removeSheetRow(groupIndex, rowIndex)} className="text-red-600 font-bold hover:underline">
                                  Remove
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <button onClick={() => addSheetRow(groupIndex)} className="mt-2 text-xs font-bold text-primary hover:underline">
                    + Add sheet
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <LineItemTable
          title="Materials"
          rows={state.materialsRows}
          onUpdate={(index, field, value) => updateLineItem("materialsRows", index, field, value)}
          onRemove={(index) => removeLineItem("materialsRows", index)}
          onAdd={() => addLineItem("materialsRows")}
          unitPlaceholder="each"
        />

        <LineItemTable
          title="Plant"
          rows={state.plantRows}
          onUpdate={(index, field, value) => updateLineItem("plantRows", index, field, value)}
          onRemove={(index) => removeLineItem("plantRows", index)}
          onAdd={() => addLineItem("plantRows")}
          unitPlaceholder="day"
        />

        <div className="mt-2 pt-3 border-t border-[#e7edf3] dark:border-slate-800 text-sm">
          <p className="text-xs text-[#4c739a] dark:text-slate-400">
            Labour {formatCurrency(labourTotal)} · Materials {formatCurrency(materialsCost)}
            {materialsMarkupAmount > 0 ? ` (+ ${formatCurrency(materialsMarkupAmount)} markup)` : ""} · Plant{" "}
            {formatCurrency(plantCost)}
          </p>
          <p className="font-bold mt-1">Combined total: {formatCurrency(grandTotal)}</p>
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
            disabled={isSaving || hasNothingToSave}
            className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
