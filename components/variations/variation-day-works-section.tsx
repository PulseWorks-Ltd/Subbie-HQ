"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DayWorksMaterial, DayWorksSheet } from "@prisma/client";

type DayWorksSheetWithMaterials = DayWorksSheet & { materials: DayWorksMaterial[] };

function formatCurrency(amount: number) {
  return amount.toLocaleString("en-NZ", { style: "currency", currency: "NZD" });
}

function materialsTotal(materials: DayWorksMaterial[]) {
  return materials.reduce((sum, material) => sum + Number(material.quantity) * Number(material.unitCost), 0);
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
  sheet: DayWorksSheetWithMaterials;
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

export function VariationDayWorksSection({
  projectId,
  itemId,
  dayWorksSheets
}: {
  projectId: string;
  itemId: string;
  dayWorksSheets: DayWorksSheetWithMaterials[];
}) {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";

    setIsUploading(true);
    const formData = new FormData();
    formData.set("file", file);
    await fetch(`/api/projects/${projectId}/variation-items/${itemId}/day-works-sheets`, {
      method: "POST",
      body: formData
    });
    setIsUploading(false);
    router.refresh();
  }

  async function handleDelete(sheetId: string) {
    if (!confirm("Delete this day works sheet?")) return;
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
            const total = materialsTotal(sheet.materials);
            return (
              <div key={sheet.id} className="rounded-lg border border-[#e7edf3] dark:border-slate-800 p-3 flex flex-col gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[#4c739a] dark:text-slate-400 mb-1.5">
                    Labour
                  </p>
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
                </div>

                <MaterialsSection projectId={projectId} itemId={itemId} sheet={sheet} />

                <p className="text-sm font-bold pt-2 border-t border-[#e7edf3] dark:border-slate-800">
                  Sheet total: {formatCurrency(total)}{" "}
                  <span className="text-xs font-normal text-[#4c739a] dark:text-slate-400">
                    (materials cost — labour hours are recorded on the attached sheet)
                  </span>
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
