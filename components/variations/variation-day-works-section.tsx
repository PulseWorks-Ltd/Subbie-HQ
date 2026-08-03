"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ContractTerms, DayWorksSheetRecord } from "@prisma/client";
import { computeSheetRecordTotal, computeSheetTotals, type DayWorksSheetWithLineItems } from "@/lib/variation-package";
import {
  DayWorksSheetRecordReviewDialog,
  emptySheetRecordRow,
  type SheetRecordRow
} from "@/components/variations/day-works-sheet-record-review-dialog";
import type { DraftSheetRecord } from "@/app/api/projects/[projectId]/variation-items/[itemId]/day-works-sheets/[sheetId]/sheet-records/extract/route";

type DayWorksSheetWithDetails = DayWorksSheetWithLineItems;

function formatCurrency(amount: number) {
  return amount.toLocaleString("en-NZ", { style: "currency", currency: "NZD" });
}

function toDateInputValue(date: Date) {
  return new Date(date).toISOString().slice(0, 10);
}

function draftRecordsToRows(records: DraftSheetRecord[]): SheetRecordRow[] {
  if (records.length === 0) return [emptySheetRecordRow("Sheet 1")];
  return records.map((record) => ({
    sheetNumber: record.sheetNumber,
    teamLeaderCount: String(record.teamLeaderCount),
    teamMemberCount: String(record.teamMemberCount),
    totalHours: record.totalHours != null ? String(record.totalHours) : "",
    ratePerHour: "",
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

// Reopening an already-saved (and therefore already human-reviewed) sheet
// via "Edit summary" carries no AI confidence signal — confidence: null so
// the review dialog never flags these rows as low-confidence.
function savedRecordsToRows(records: DayWorksSheetRecord[]): SheetRecordRow[] {
  return records.map((record) => ({
    sheetNumber: record.sheetNumber,
    teamLeaderCount: String(record.teamLeaderCount),
    teamMemberCount: String(record.teamMemberCount),
    totalHours: record.totalHours != null ? String(Number(record.totalHours)) : "",
    ratePerHour: record.ratePerHour != null ? String(Number(record.ratePerHour)) : "",
    date: record.date ? toDateInputValue(record.date) : "",
    startTime: record.startTime ?? "",
    finishTime: record.finishTime ?? "",
    task: record.task ?? "",
    notes: record.notes ?? "",
    weather: record.weather ?? "",
    location: record.location ?? "",
    confidence: null
  }));
}

function MaterialForm({
  projectId,
  itemId,
  sheetId
}: {
  projectId: string;
  itemId: string;
  sheetId: string;
}) {
  const router = useRouter();
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

    const response = await fetch(
      `/api/projects/${projectId}/variation-items/${itemId}/day-works-sheets/${sheetId}/materials`,
      { method: "POST", body: formData }
    );
    setIsSaving(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(typeof body?.error === "string" ? body.error : "Could not add material.");
      return;
    }

    setDescription("");
    setQuantity("");
    setUnit("");
    setUnitCost("");
    setPhoto(null);
    router.refresh();
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
        {photo ? "Photo selected" : "+ Receipt"}
        <input
          type="file"
          accept="image/*"
          onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
          className="hidden"
        />
      </label>
      <button
        type="submit"
        disabled={isSaving}
        className="h-8 px-3 rounded-lg bg-primary text-white text-[11px] font-bold hover:bg-primary/90 disabled:opacity-60 whitespace-nowrap"
      >
        {isSaving ? "Adding..." : "+ Add material"}
      </button>
      {error && <p className="text-xs text-red-600 w-full">{error}</p>}
    </form>
  );
}

function MaterialsSection({
  projectId,
  itemId,
  sheet
}: {
  projectId: string;
  itemId: string;
  sheet: DayWorksSheetWithDetails;
}) {
  const router = useRouter();

  async function handleDeleteMaterial(materialId: string) {
    if (!confirm("Delete this material line item?")) return;
    await fetch(
      `/api/projects/${projectId}/variation-items/${itemId}/day-works-sheets/${sheet.id}/materials/${materialId}`,
      { method: "DELETE" }
    );
    router.refresh();
  }

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-[#4c739a] dark:text-slate-400 mb-1.5">Materials</p>

      {sheet.materials.length === 0 ? (
        <p className="text-xs text-[#4c739a] dark:text-slate-400 mb-2">No materials recorded yet.</p>
      ) : (
        <div className="flex flex-col gap-1.5 mb-2">
          {sheet.materials.map((material) => (
            <div key={material.id} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="truncate">
                  {material.description} — {Number(material.quantity)} {material.unit} @{" "}
                  {formatCurrency(Number(material.unitCost))}
                </span>
                {material.photoStorageKey && (
                  <a
                    href={`/api/projects/${projectId}/variation-items/${itemId}/day-works-sheets/${sheet.id}/materials/${material.id}/photo`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline shrink-0"
                  >
                    Receipt
                  </a>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-bold">
                  {formatCurrency(Number(material.quantity) * Number(material.unitCost))}
                </span>
                <button onClick={() => handleDeleteMaterial(material.id)} className="text-red-600 hover:underline">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <MaterialForm projectId={projectId} itemId={itemId} sheetId={sheet.id} />
    </div>
  );
}

// Mirrors MaterialForm exactly (same fields, same S3 photo-attachment
// pattern) — the only difference is which endpoint it posts to and that
// this line item never receives materials markup (Task 1.1).
function PlantForm({
  projectId,
  itemId,
  sheetId
}: {
  projectId: string;
  itemId: string;
  sheetId: string;
}) {
  const router = useRouter();
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

    const response = await fetch(
      `/api/projects/${projectId}/variation-items/${itemId}/day-works-sheets/${sheetId}/plant`,
      { method: "POST", body: formData }
    );
    setIsSaving(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(typeof body?.error === "string" ? body.error : "Could not add plant.");
      return;
    }

    setDescription("");
    setQuantity("");
    setUnit("");
    setUnitCost("");
    setPhoto(null);
    router.refresh();
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
          placeholder="e.g. Scissor Lift"
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
          placeholder="day"
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
        {photo ? "Photo selected" : "+ Docket"}
        <input
          type="file"
          accept="image/*"
          onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
          className="hidden"
        />
      </label>
      <button
        type="submit"
        disabled={isSaving}
        className="h-8 px-3 rounded-lg bg-primary text-white text-[11px] font-bold hover:bg-primary/90 disabled:opacity-60 whitespace-nowrap"
      >
        {isSaving ? "Adding..." : "+ Add plant"}
      </button>
      {error && <p className="text-xs text-red-600 w-full">{error}</p>}
    </form>
  );
}

function PlantSection({
  projectId,
  itemId,
  sheet
}: {
  projectId: string;
  itemId: string;
  sheet: DayWorksSheetWithDetails;
}) {
  const router = useRouter();

  async function handleDeletePlant(plantId: string) {
    if (!confirm("Delete this plant line item?")) return;
    await fetch(
      `/api/projects/${projectId}/variation-items/${itemId}/day-works-sheets/${sheet.id}/plant/${plantId}`,
      { method: "DELETE" }
    );
    router.refresh();
  }

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-[#4c739a] dark:text-slate-400 mb-1.5">
        Plant <span className="font-normal normal-case">(no markup applied)</span>
      </p>

      {sheet.plant.length === 0 ? (
        <p className="text-xs text-[#4c739a] dark:text-slate-400 mb-2">No plant recorded yet.</p>
      ) : (
        <div className="flex flex-col gap-1.5 mb-2">
          {sheet.plant.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="truncate">
                  {item.description} — {Number(item.quantity)} {item.unit} @ {formatCurrency(Number(item.unitCost))}
                </span>
                {item.photoStorageKey && (
                  <a
                    href={`/api/projects/${projectId}/variation-items/${itemId}/day-works-sheets/${sheet.id}/plant/${item.id}/photo`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline shrink-0"
                  >
                    Docket
                  </a>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-bold">{formatCurrency(Number(item.quantity) * Number(item.unitCost))}</span>
                <button onClick={() => handleDeletePlant(item.id)} className="text-red-600 hover:underline">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <PlantForm projectId={projectId} itemId={itemId} sheetId={sheet.id} />
    </div>
  );
}

function SheetRecordsSection({
  projectId,
  itemId,
  sheet
}: {
  projectId: string;
  itemId: string;
  sheet: DayWorksSheetWithDetails;
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
      setReviewState({ rows: [emptySheetRecordRow("Sheet 1")], warning: null });
      return;
    }

    setReviewState({ rows: draftRecordsToRows(body.records ?? []), warning: body.warning ?? null });
  }

  function openManualEdit() {
    setReviewState({ rows: savedRecordsToRows(sheet.sheetRecords), warning: null });
  }

  const hoursMissingRate = sheet.sheetRecords.reduce((sum, record) => {
    if (record.totalHours != null && record.ratePerHour == null) return sum + Number(record.totalHours);
    return sum;
  }, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs font-bold uppercase tracking-wide text-[#4c739a] dark:text-slate-400">Dayworks Summary</p>
        <div className="flex items-center gap-3">
          {sheet.sheetRecords.length > 0 && (
            <button onClick={openManualEdit} className="text-xs font-bold text-primary hover:underline">
              Edit summary
            </button>
          )}
          <button onClick={runExtraction} disabled={isExtracting} className="text-xs font-bold text-primary hover:underline disabled:opacity-60">
            {isExtracting ? "Reading sheet..." : sheet.sheetRecords.length > 0 ? "Re-extract" : "Extract summary"}
          </button>
        </div>
      </div>

      {extractError && <p className="text-xs text-red-600 mb-2">{extractError}</p>}

      {sheet.sheetRecords.length === 0 ? (
        <p className="text-xs text-[#4c739a] dark:text-slate-400 mb-2">
          No dayworks summary yet — click "Extract summary" to read it from the uploaded sheet.
        </p>
      ) : (
        <div className="flex flex-col gap-1 mb-2 text-xs">
          {sheet.sheetRecords.map((record) => {
            const hours = record.totalHours != null ? Number(record.totalHours) : null;
            const rate = record.ratePerHour != null ? Number(record.ratePerHour) : null;
            const cost = computeSheetRecordTotal(record.totalHours, record.ratePerHour);
            return (
              <div key={record.id} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {record.sheetNumber} — {record.teamLeaderCount} leader{record.teamLeaderCount === 1 ? "" : "s"},{" "}
                  {record.teamMemberCount} member{record.teamMemberCount === 1 ? "" : "s"}
                  {hours != null ? ` · ${hours}h` : ""}
                  {rate != null ? ` @ ${formatCurrency(rate)}/hr` : ""}
                </span>
                <span className="font-bold shrink-0">{cost != null ? formatCurrency(cost) : "—"}</span>
              </div>
            );
          })}
          {hoursMissingRate > 0 && (
            <p className="text-amber-600 dark:text-amber-400">
              {hoursMissingRate.toFixed(2)} hrs not costed — enter a rate above.
            </p>
          )}
        </div>
      )}

      {reviewState && (
        <DayWorksSheetRecordReviewDialog
          projectId={projectId}
          itemId={itemId}
          sheetId={sheet.id}
          initialRows={reviewState.rows}
          warning={reviewState.warning}
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

export function VariationDayWorksSection({
  projectId,
  itemId,
  dayWorksSheets,
  contractTerms
}: {
  projectId: string;
  itemId: string;
  dayWorksSheets: DayWorksSheetWithDetails[];
  contractTerms: ContractTerms | null;
}) {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [pendingReview, setPendingReview] = useState<{ sheetId: string; rows: SheetRecordRow[]; warning: string | null } | null>(null);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";

    setIsUploading(true);
    const formData = new FormData();
    formData.set("file", file);
    const uploadResponse = await fetch(`/api/projects/${projectId}/variation-items/${itemId}/day-works-sheets`, {
      method: "POST",
      body: formData
    });
    const uploadBody = await uploadResponse.json().catch(() => null);
    setIsUploading(false);
    router.refresh();

    const sheetId = uploadBody?.dayWorksSheet?.id;
    if (!uploadResponse.ok || !sheetId) return;

    const extractResponse = await fetch(
      `/api/projects/${projectId}/variation-items/${itemId}/day-works-sheets/${sheetId}/sheet-records/extract`,
      { method: "POST" }
    );
    const extractBody = await extractResponse.json().catch(() => null);
    if (!extractResponse.ok) return;

    setPendingReview({ sheetId, rows: draftRecordsToRows(extractBody.records ?? []), warning: extractBody.warning ?? null });
  }

  async function handleDelete(sheetId: string) {
    if (!confirm("Delete this Day Works Sheet? This will permanently remove its labour, materials, and plant entries.")) return;
    await fetch(`/api/projects/${projectId}/variation-items/${itemId}/day-works-sheets/${sheetId}`, {
      method: "DELETE"
    });
    router.refresh();
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#cfdbe7] dark:border-slate-800 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold">Day Works Sheets</h3>
        <label className="text-xs font-bold text-primary hover:underline cursor-pointer">
          {isUploading ? "Uploading..." : "+ Upload"}
          <input type="file" onChange={handleUpload} disabled={isUploading} className="hidden" />
        </label>
      </div>

      {dayWorksSheets.length === 0 ? (
        <p className="text-sm text-[#4c739a] dark:text-slate-400">No day works sheets uploaded yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {dayWorksSheets.map((sheet) => {
            const { labour, materialsCost, materialsMarkupAmount, plantCost, combinedTotal } = computeSheetTotals(
              sheet,
              contractTerms
            );
            const markupPercent = contractTerms?.materialsMarkupPercent ?? null;

            return (
              <div key={sheet.id} className="rounded-lg border border-[#e7edf3] dark:border-slate-800 p-3 flex flex-col gap-3">
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
                  <button
                    onClick={() => handleDelete(sheet.id)}
                    className="text-xs font-bold text-red-600 hover:underline shrink-0"
                  >
                    Delete sheet
                  </button>
                </div>

                <SheetRecordsSection projectId={projectId} itemId={itemId} sheet={sheet} />

                <MaterialsSection projectId={projectId} itemId={itemId} sheet={sheet} />

                <PlantSection projectId={projectId} itemId={itemId} sheet={sheet} />

                <div className="pt-2 border-t border-[#e7edf3] dark:border-slate-800">
                  <p className="text-sm font-bold">
                    Sheet total: {formatCurrency(combinedTotal)}{" "}
                    <span className="text-xs font-normal text-[#4c739a] dark:text-slate-400">
                      (labour {formatCurrency(labour.total)} + materials {formatCurrency(materialsCost)}
                      {markupPercent != null ? ` + ${markupPercent}% markup ${formatCurrency(materialsMarkupAmount)}` : ""}
                      {" "}+ plant {formatCurrency(plantCost)})
                    </span>
                  </p>
                  {labour.hoursMissingRate > 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {labour.hoursMissingRate.toFixed(2)} labour hrs not costed — enter a rate above to include them.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pendingReview && (
        <DayWorksSheetRecordReviewDialog
          projectId={projectId}
          itemId={itemId}
          sheetId={pendingReview.sheetId}
          initialRows={pendingReview.rows}
          warning={pendingReview.warning}
          onClose={() => setPendingReview(null)}
          onSaved={() => {
            setPendingReview(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
