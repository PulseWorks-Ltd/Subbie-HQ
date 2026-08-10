"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ContractTerms, DayWorksMaterial, DayWorksPlant, DayWorksSheetRecord } from "@prisma/client";
import { computeSheetRecordTotal, computePackageTotals, type DayWorksSheetWithRecords } from "@/lib/variation-package";
import {
  DayWorksSheetRecordReviewDialog,
  draftRecordsToRows,
  savedRecordsToRows,
  type SheetRecordRow
} from "@/components/variations/day-works-sheet-record-review-dialog";
import { LabourPlantMaterialReviewDialog } from "@/components/variations/labour-plant-material-review-dialog";
import type { ClassifiedFileResult } from "@/app/api/projects/[projectId]/variation-items/[itemId]/labour-plant-material/classify/route";

function formatCurrency(amount: number) {
  return amount.toLocaleString("en-NZ", { style: "currency", currency: "NZD" });
}

function LineItemList({
  title,
  hint,
  items,
  onDelete,
  photoHref,
  photoLabel
}: {
  title: string;
  hint?: string;
  items: (DayWorksMaterial | DayWorksPlant)[];
  onDelete: (id: string) => void;
  photoHref: (id: string) => string;
  photoLabel: string;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-[#4c739a] dark:text-slate-400 mb-1.5">
        {title} {hint && <span className="font-normal normal-case">({hint})</span>}
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-[#4c739a] dark:text-slate-400 mb-2">None recorded yet.</p>
      ) : (
        <div className="flex flex-col gap-1.5 mb-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="truncate">
                  {item.description} — {Number(item.quantity)} {item.unit} @ {formatCurrency(Number(item.unitCost))}
                </span>
                {item.photoStorageKey && (
                  <a href={photoHref(item.id)} target="_blank" rel="noreferrer" className="text-primary hover:underline shrink-0">
                    {photoLabel}
                  </a>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-bold">{formatCurrency(Number(item.quantity) * Number(item.unitCost))}</span>
                <button onClick={() => onDelete(item.id)} className="text-red-600 hover:underline">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ManualLineItemForm({
  endpoint,
  photoLabel,
  photoAccept,
  onSaved
}: {
  endpoint: string;
  photoLabel: string;
  photoAccept: string;
  onSaved: () => void;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    const formData = new FormData();
    formData.set("description", description);
    formData.set("quantity", quantity);
    formData.set("unit", unit);
    formData.set("unitCost", unitCost);
    if (photo) formData.set("photo", photo);

    const response = await fetch(endpoint, { method: "POST", body: formData });
    setIsSaving(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(typeof body?.error === "string" ? body.error : "Could not add this line item.");
      return;
    }

    setDescription("");
    setQuantity("");
    setUnit("");
    setUnitCost("");
    setPhoto(null);
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-[11px] font-medium flex-1 min-w-[140px]">
        Description
        <input
          type="text"
          required
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="h-8 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs"
        />
      </label>
      <label className="flex flex-col gap-1 text-[11px] font-medium w-16">
        Qty
        <input
          type="number"
          step="0.01"
          min="0"
          required
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          className="h-8 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs"
        />
      </label>
      <label className="flex flex-col gap-1 text-[11px] font-medium w-20">
        Unit
        <input
          type="text"
          required
          placeholder="each"
          value={unit}
          onChange={(event) => setUnit(event.target.value)}
          className="h-8 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs"
        />
      </label>
      <label className="flex flex-col gap-1 text-[11px] font-medium w-24">
        Unit cost
        <input
          type="number"
          step="0.01"
          min="0"
          required
          value={unitCost}
          onChange={(event) => setUnitCost(event.target.value)}
          className="h-8 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs"
        />
      </label>
      <label className="text-[11px] font-bold text-primary hover:underline cursor-pointer h-8 flex items-center px-1 whitespace-nowrap">
        {photo ? "Photo selected" : `+ ${photoLabel}`}
        <input type="file" accept={photoAccept} onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} className="hidden" />
      </label>
      <button
        type="submit"
        disabled={isSaving}
        className="h-8 px-3 rounded-lg bg-primary text-white text-[11px] font-bold hover:bg-primary/90 disabled:opacity-60 whitespace-nowrap"
      >
        {isSaving ? "Adding..." : "+ Add"}
      </button>
      {error && <p className="text-xs text-red-600 w-full">{error}</p>}
    </form>
  );
}

function SheetCard({
  projectId,
  itemId,
  sheet,
  defaultRatePerHour
}: {
  projectId: string;
  itemId: string;
  sheet: DayWorksSheetWithRecords;
  defaultRatePerHour: string;
}) {
  const router = useRouter();
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [reviewState, setReviewState] = useState<{ rows: SheetRecordRow[]; warning: string | null } | null>(null);

  async function runExtraction() {
    setIsExtracting(true);
    setExtractError(null);
    const response = await fetch(
      `/api/projects/${projectId}/variation-items/${itemId}/day-works-sheets/${sheet.id}/sheet-records/extract`,
      { method: "POST" }
    );
    const body = await response.json().catch(() => null);
    setIsExtracting(false);

    if (!response.ok) {
      setExtractError(
        typeof body?.error === "string" ? body.error : "Could not read this sheet automatically. You can still add a summary manually."
      );
      setReviewState({ rows: [], warning: null });
      return;
    }

    setReviewState({ rows: draftRecordsToRows(body.records ?? [], defaultRatePerHour), warning: body.warning ?? null });
  }

  function openManualEdit() {
    setReviewState({ rows: savedRecordsToRows(sheet.sheetRecords), warning: null });
  }

  async function handleDelete() {
    if (!confirm("Delete this Day Works Sheet? This removes its labour summary — any Materials/Plant logged from it are unaffected.")) return;
    await fetch(`/api/projects/${projectId}/variation-items/${itemId}/day-works-sheets/${sheet.id}`, { method: "DELETE" });
    router.refresh();
  }

  const hoursMissingRate = sheet.sheetRecords.reduce((sum, record) => {
    if (record.totalHours != null && record.ratePerHour == null) return sum + Number(record.totalHours);
    return sum;
  }, 0);
  const labourTotal = sheet.sheetRecords.reduce((sum, record) => sum + (computeSheetRecordTotal(record.totalHours, record.ratePerHour) ?? 0), 0);

  return (
    <div className="rounded-lg border border-[#e7edf3] dark:border-slate-800 p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <a
          href={`/api/projects/${projectId}/variation-items/${itemId}/day-works-sheets/${sheet.id}/file`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 text-sm text-primary hover:underline min-w-0 truncate"
        >
          <span className="material-symbols-outlined text-lg shrink-0">description</span>
          <span className="truncate">{sheet.fileName}</span>
        </a>
        <div className="flex items-center gap-3 shrink-0">
          {sheet.sheetRecords.length > 0 && (
            <button onClick={openManualEdit} className="text-xs font-bold text-primary hover:underline">
              Edit summary
            </button>
          )}
          <button onClick={runExtraction} disabled={isExtracting} className="text-xs font-bold text-primary hover:underline disabled:opacity-60">
            {isExtracting ? "Reading..." : sheet.sheetRecords.length > 0 ? "Re-extract" : "Extract summary"}
          </button>
          <button onClick={handleDelete} className="text-xs font-bold text-red-600 hover:underline">
            Delete
          </button>
        </div>
      </div>

      {extractError && <p className="text-xs text-red-600">{extractError}</p>}

      {sheet.sheetRecords.length === 0 ? (
        <p className="text-xs text-[#4c739a] dark:text-slate-400">No labour summary yet.</p>
      ) : (
        <div className="flex flex-col gap-1 text-xs">
          {sheet.sheetRecords.map((record) => {
            const hours = record.totalHours != null ? Number(record.totalHours) : null;
            const rate = record.ratePerHour != null ? Number(record.ratePerHour) : null;
            const cost = computeSheetRecordTotal(record.totalHours, record.ratePerHour);
            return (
              <div key={record.id} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {record.sheetNumber} — {record.teamLeaderCount} leader{record.teamLeaderCount === 1 ? "" : "s"}, {record.teamMemberCount} member
                  {record.teamMemberCount === 1 ? "" : "s"}
                  {hours != null ? ` · ${hours}h` : ""}
                  {rate != null ? ` @ ${formatCurrency(rate)}/hr` : ""}
                </span>
                <span className="font-bold shrink-0">{cost != null ? formatCurrency(cost) : "—"}</span>
              </div>
            );
          })}
          {hoursMissingRate > 0 && (
            <p className="text-amber-600 dark:text-amber-400">{hoursMissingRate.toFixed(2)} hrs not costed — enter a rate above.</p>
          )}
          <p className="font-bold pt-1 border-t border-[#e7edf3] dark:border-slate-800 mt-1">Labour total: {formatCurrency(labourTotal)}</p>
        </div>
      )}

      {reviewState && (
        <DayWorksSheetRecordReviewDialog
          projectId={projectId}
          itemId={itemId}
          sheetId={sheet.id}
          initialRows={reviewState.rows.length > 0 ? reviewState.rows : [{ sheetNumber: "Sheet 1", teamLeaderCount: "", teamMemberCount: "", totalHours: "", ratePerHour: defaultRatePerHour, date: "", startTime: "", finishTime: "", task: "", notes: "", weather: "", location: "", confidence: null }]}
          warning={reviewState.warning}
          defaultRatePerHour={defaultRatePerHour}
          onClose={() => setReviewState(null)}
          onSaved={() => {
            setReviewState(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

export function LabourPlantMaterialSection({
  projectId,
  itemId,
  dayWorksSheets,
  materials,
  plant,
  contractTerms
}: {
  projectId: string;
  itemId: string;
  dayWorksSheets: (DayWorksSheetWithRecords & { sheetRecords: DayWorksSheetRecord[] })[];
  materials: DayWorksMaterial[];
  plant: DayWorksPlant[];
  contractTerms: ContractTerms | null;
}) {
  const router = useRouter();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isClassifying, setIsClassifying] = useState(false);
  const [classifyError, setClassifyError] = useState<string | null>(null);
  const [reviewFiles, setReviewFiles] = useState<ClassifiedFileResult[] | null>(null);

  // The project's configured Normal-hours Day Works rate, pre-filled onto
  // every row a review dialog opens with — genuinely empty when Settings
  // has no rate configured (same graceful-degradation principle used
  // throughout this feature).
  const defaultRatePerHour =
    contractTerms?.dayWorksRateNormal != null ? String(Number(contractTerms.dayWorksRateNormal)) : "";

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    setSelectedFiles((current) => [...current, ...files]);
    event.target.value = "";
  }

  function removeSelectedFile(index: number) {
    setSelectedFiles((current) => current.filter((_, i) => i !== index));
  }

  async function handleExtract() {
    setIsClassifying(true);
    setClassifyError(null);
    const formData = new FormData();
    selectedFiles.forEach((file) => formData.append("files", file));

    const response = await fetch(`/api/projects/${projectId}/variation-items/${itemId}/labour-plant-material/classify`, {
      method: "POST",
      body: formData
    });
    const body = await response.json().catch(() => null);
    setIsClassifying(false);

    if (!response.ok || !body?.results) {
      setClassifyError(typeof body?.error === "string" ? body.error : "Could not read these files automatically.");
      return;
    }

    setSelectedFiles([]);
    setReviewFiles(body.results);
  }

  async function handleDeleteMaterial(materialId: string) {
    if (!confirm("Delete this material line item?")) return;
    await fetch(`/api/projects/${projectId}/variation-items/${itemId}/materials/${materialId}`, { method: "DELETE" });
    router.refresh();
  }

  async function handleDeletePlant(plantId: string) {
    if (!confirm("Delete this plant line item?")) return;
    await fetch(`/api/projects/${projectId}/variation-items/${itemId}/plant/${plantId}`, { method: "DELETE" });
    router.refresh();
  }

  const totals = computePackageTotals(dayWorksSheets, materials, plant, contractTerms);
  const markupPercent = contractTerms?.materialsMarkupPercent ?? null;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#cfdbe7] dark:border-slate-800 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold">Labour, Materials &amp; Plant</h3>
        <label className="text-xs font-bold text-primary hover:underline cursor-pointer">
          + Upload
          <input type="file" multiple onChange={handleFileSelect} className="hidden" />
        </label>
      </div>

      {selectedFiles.length > 0 && (
        <div className="mb-4 rounded-lg border border-[#e7edf3] dark:border-slate-800 p-3">
          <p className="text-xs font-bold mb-2">{selectedFiles.length} file{selectedFiles.length === 1 ? "" : "s"} selected</p>
          <ul className="flex flex-col gap-1 mb-2 text-xs">
            {selectedFiles.map((file, index) => (
              <li key={index} className="flex items-center justify-between gap-2">
                <span className="truncate">{file.name}</span>
                <button onClick={() => removeSelectedFile(index)} className="text-red-600 hover:underline shrink-0">
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <button
            onClick={handleExtract}
            disabled={isClassifying}
            className="h-8 px-3 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 disabled:opacity-60"
          >
            {isClassifying ? "Reading files..." : "Extract"}
          </button>
        </div>
      )}
      {classifyError && <p className="text-xs text-red-600 mb-3">{classifyError}</p>}

      <div className="flex flex-col gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[#4c739a] dark:text-slate-400 mb-1.5">Day Works Sheets</p>
          {dayWorksSheets.length === 0 ? (
            <p className="text-xs text-[#4c739a] dark:text-slate-400 mb-2">No day works sheets uploaded yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {dayWorksSheets.map((sheet) => (
                <SheetCard key={sheet.id} projectId={projectId} itemId={itemId} sheet={sheet} defaultRatePerHour={defaultRatePerHour} />
              ))}
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-[#e7edf3] dark:border-slate-800">
          <LineItemList
            title="Materials"
            items={materials}
            onDelete={handleDeleteMaterial}
            photoHref={(id) => `/api/projects/${projectId}/variation-items/${itemId}/materials/${id}/photo`}
            photoLabel="Receipt"
          />
          <ManualLineItemForm
            endpoint={`/api/projects/${projectId}/variation-items/${itemId}/materials`}
            photoLabel="Receipt"
            photoAccept="image/*"
            onSaved={() => router.refresh()}
          />
        </div>

        <div className="pt-2 border-t border-[#e7edf3] dark:border-slate-800">
          <LineItemList
            title="Plant"
            hint="no markup applied"
            items={plant}
            onDelete={handleDeletePlant}
            photoHref={(id) => `/api/projects/${projectId}/variation-items/${itemId}/plant/${id}/photo`}
            photoLabel="Docket"
          />
          <ManualLineItemForm
            endpoint={`/api/projects/${projectId}/variation-items/${itemId}/plant`}
            photoLabel="Docket"
            photoAccept="image/*"
            onSaved={() => router.refresh()}
          />
        </div>

        <div className="pt-3 border-t border-[#e7edf3] dark:border-slate-800">
          <p className="text-sm font-bold">
            Combined total: {formatCurrency(totals.grandTotal)}{" "}
            <span className="text-xs font-normal text-[#4c739a] dark:text-slate-400">
              (labour {formatCurrency(totals.labourTotal)} + materials {formatCurrency(totals.materialsTotal)}
              {markupPercent != null ? ` + ${markupPercent}% markup ${formatCurrency(totals.materialsMarkupTotal)}` : ""} + plant{" "}
              {formatCurrency(totals.plantTotal)})
            </span>
          </p>
        </div>
      </div>

      {reviewFiles && (
        <LabourPlantMaterialReviewDialog
          projectId={projectId}
          itemId={itemId}
          files={reviewFiles}
          defaultRatePerHour={defaultRatePerHour}
          contractTerms={contractTerms}
          onClose={() => setReviewFiles(null)}
          onSaved={() => {
            setReviewFiles(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
