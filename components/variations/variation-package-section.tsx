"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ContractTerms, Correspondence, VariationItem, VariationPackage, VariationPhoto } from "@prisma/client";
import {
  computePackageTotals,
  computeSheetTotals,
  PACKAGE_CATEGORIES,
  PACKAGE_CATEGORY_LABELS,
  type DayWorksSheetWithLineItems,
  type PackageCategory
} from "@/lib/variation-package";

function formatCurrency(amount: number) {
  return amount.toLocaleString("en-NZ", { style: "currency", currency: "NZD" });
}

function formatDate(date: Date | null) {
  if (!date) return "Not recorded";
  return new Date(date).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(date: Date) {
  return new Date(date).toLocaleString("en-NZ", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Confirm-before-generate screen (Task 2.2) — deliberately read-only. Every
// number here is computed from the exact same props (dayWorksSheets,
// contractTerms) already passed down to VariationDayWorksSection, via the
// same shared helper (lib/variation-package.ts), so this screen can never
// show a different total than what the sheets themselves display. If a
// rate looks wrong, the fix is at the source (Day Works Sheet or Project
// Settings) — no inline editing here, this is a preview of what generation
// will freeze, not a new place to change data.
function GeneratePackageReviewDialog({
  projectId,
  itemId,
  item,
  dayWorksSheets,
  photos,
  correspondence,
  updates,
  contractTerms,
  onClose,
  onGenerated
}: {
  projectId: string;
  itemId: string;
  item: VariationItem;
  dayWorksSheets: DayWorksSheetWithLineItems[];
  photos: VariationPhoto[];
  correspondence: Correspondence[];
  updates: { id: string }[];
  contractTerms: ContractTerms | null;
  onClose: () => void;
  onGenerated: () => void;
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Per-generation only (Task 2.3) — a fresh useState initializer runs
  // every time this dialog mounts, which is every time it's opened (see
  // VariationPackageSection's `{isReviewOpen && <GeneratePackageReviewDialog .../>}`),
  // so this naturally resets to all-checked with no extra reset logic.
  const [included, setIncluded] = useState<Record<PackageCategory, boolean>>({
    quote: true,
    day_works_sheets: true,
    si_source_document: true,
    correspondence: true,
    linked_updates: true,
    photos: true
  });

  const categoryCounts: Record<PackageCategory, number> = {
    quote: item.quoteFileName && item.quoteStorageKey ? 1 : 0,
    day_works_sheets: dayWorksSheets.length,
    si_source_document: item.fileName && item.storageKey ? 1 : 0,
    correspondence: correspondence.length,
    linked_updates: updates.length,
    photos: photos.length
  };

  function toggleCategory(category: PackageCategory) {
    setIncluded((current) => ({ ...current, [category]: !current[category] }));
  }

  // Grand Total (Task 2.1/2.2) — Day Works Sheets is the only category
  // that contributes a dollar figure, so excluding it means computing the
  // exact same shared helper (computePackageTotals) against an empty
  // array rather than duplicating its maths — an empty array already
  // naturally sums to all-zero.
  const packageTotals = computePackageTotals(included.day_works_sheets ? dayWorksSheets : [], contractTerms);

  async function handleGenerate() {
    setError(null);
    setIsGenerating(true);
    const includedCategories = PACKAGE_CATEGORIES.filter((category) => included[category]);
    const response = await fetch(`/api/projects/${projectId}/variation-items/${itemId}/packages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ includedCategories })
    });
    setIsGenerating(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(typeof body?.error === "string" ? body.error : "Could not generate the package.");
      return;
    }
    onGenerated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="relative w-full max-w-2xl rounded-xl bg-white dark:bg-slate-900 p-6 shadow-lg max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 rounded-lg p-1 text-[#4c739a] hover:bg-[#e7edf3] dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>
        <h2 className="text-lg font-bold mb-1">Generate Variation Package</h2>
        <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-5">
          Review everything that will be included below. Nothing is generated until you confirm — if a rate or
          figure looks wrong, close this and fix it at the source (the relevant Day Works Sheet or Project
          Settings), then come back.
        </p>

        <div className="flex flex-col gap-4 text-sm">
          <div className="rounded-lg border border-[#e7edf3] dark:border-slate-800 p-4">
            <p className="font-bold">
              {item.reference} · {item.title}
            </p>
            {item.description && <p className="text-[#4c739a] dark:text-slate-400 mt-1">{item.description}</p>}
            <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-xs text-[#4c739a] dark:text-slate-400">
              <span>Notified {formatDate(item.notifiedAt)}</span>
              <span>Instructed by {item.instructedByName || "Not recorded"}</span>
            </div>
          </div>

          <div className="rounded-lg border border-[#e7edf3] dark:border-slate-800 p-4">
            <p className="font-bold mb-2">Include in this package</p>
            <p className="text-xs text-[#4c739a] dark:text-slate-400 mb-3">
              Unchecking a category leaves it out of this generated document only — it stays attached to this item
              and is available again next time you generate a package.
            </p>
            <div className="flex flex-col gap-1.5">
              {PACKAGE_CATEGORIES.map((category) => {
                const count = categoryCounts[category];
                const disabled = count === 0;
                return (
                  <label
                    key={category}
                    className={`flex items-center gap-2 text-sm ${disabled ? "opacity-50" : "cursor-pointer"}`}
                  >
                    <input
                      type="checkbox"
                      checked={!disabled && included[category]}
                      disabled={disabled}
                      onChange={() => toggleCategory(category)}
                      className="size-4 rounded border-[#cfdbe7] dark:border-slate-700 text-primary focus:ring-primary/40"
                    />
                    {PACKAGE_CATEGORY_LABELS[category]} ({count})
                  </label>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-[#e7edf3] dark:border-slate-800 p-4">
            <p className="font-bold mb-2">
              Photos ({included.photos ? photos.length : 0}), Correspondence (
              {included.correspondence ? correspondence.length : 0}), Day Works Sheets (
              {included.day_works_sheets ? dayWorksSheets.length : 0})
            </p>
            {included.photos && photos.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {/* Stored derivative, not the full original (Task 2.2) —
                    this is a read-only preview strip with no click-through,
                    so there's no separate "view full original" link here. */}
                {photos.slice(0, 8).map((photo) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={photo.id}
                    src={`/api/projects/${projectId}/variation-items/${itemId}/photos/${photo.id}/file?variant=thumbnail`}
                    alt={photo.fileName}
                    className="size-14 rounded object-cover border border-[#e7edf3] dark:border-slate-700"
                  />
                ))}
                {photos.length > 8 && (
                  <span className="size-14 rounded border border-[#e7edf3] dark:border-slate-700 flex items-center justify-center text-xs text-[#4c739a] dark:text-slate-400">
                    +{photos.length - 8}
                  </span>
                )}
              </div>
            )}
          </div>

          {included.day_works_sheets && dayWorksSheets.length > 0 && (
            <div className="flex flex-col gap-2">
              {dayWorksSheets.map((sheet) => {
                const totals = computeSheetTotals(sheet, contractTerms);
                const rateSummaries = sheet.sheetRecords
                  .filter((record) => record.totalHours != null)
                  .map((record) => {
                    const hours = Number(record.totalHours);
                    const rate = record.ratePerHour != null ? Number(record.ratePerHour) : null;
                    return `${record.sheetNumber}: ${hours}h${rate != null ? ` @ ${formatCurrency(rate)}/hr` : " (rate not entered)"}`;
                  });

                return (
                  <div key={sheet.id} className="rounded-lg border border-[#e7edf3] dark:border-slate-800 p-3 text-xs">
                    <p className="font-bold mb-1">{sheet.fileName}</p>
                    {rateSummaries.length > 0 && (
                      <p className="text-[#4c739a] dark:text-slate-400 mb-1">Rates applied: {rateSummaries.join(", ")}</p>
                    )}
                    <div className="flex flex-wrap gap-x-4">
                      <span>Labour: {formatCurrency(totals.labour.total)}</span>
                      <span>Materials: {formatCurrency(totals.materialsCost)}</span>
                      <span>Markup: {formatCurrency(totals.materialsMarkupAmount)}</span>
                      <span>Plant: {formatCurrency(totals.plantCost)}</span>
                      <span className="font-bold">Sheet total: {formatCurrency(totals.combinedTotal)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
            <p className="text-xs text-[#4c739a] dark:text-slate-400">Labour {formatCurrency(packageTotals.labourTotal)} · Materials {formatCurrency(packageTotals.materialsTotal)} · Markup {formatCurrency(packageTotals.materialsMarkupTotal)} · Plant {formatCurrency(packageTotals.plantTotal)}</p>
            <p className="text-lg font-bold mt-1">Grand total: {formatCurrency(packageTotals.grandTotal)}</p>
          </div>
        </div>

        {error && <p className="text-sm text-red-600 mt-4">{error}</p>}

        <div className="flex gap-3 justify-end mt-5">
          <button
            onClick={onClose}
            className="h-10 px-4 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
          >
            {isGenerating ? "Generating..." : "Confirm & Generate PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function VariationPackageSection({
  projectId,
  itemId,
  item,
  dayWorksSheets,
  photos,
  correspondence,
  updates,
  contractTerms,
  packages
}: {
  projectId: string;
  itemId: string;
  item: VariationItem;
  dayWorksSheets: DayWorksSheetWithLineItems[];
  photos: VariationPhoto[];
  correspondence: Correspondence[];
  updates: { id: string }[];
  contractTerms: ContractTerms | null;
  packages: VariationPackage[];
}) {
  const router = useRouter();
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#cfdbe7] dark:border-slate-800 p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold">Variation Package</h3>
          <p className="text-xs text-[#4c739a] dark:text-slate-400">
            Bundle everything attached to this item into a downloadable PDF — evidence gathering, not an assessment.
          </p>
        </div>
        <button
          onClick={() => setIsReviewOpen(true)}
          className="h-9 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 shrink-0"
        >
          Generate Variation Package
        </button>
      </div>

      {packages.length === 0 ? (
        <p className="text-sm text-[#4c739a] dark:text-slate-400">No packages generated yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-[#e7edf3] dark:border-slate-800 px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium truncate">{formatDateTime(pkg.createdAt)}</p>
                <p className="text-xs text-[#4c739a] dark:text-slate-400">
                  Grand total {formatCurrency(Number(pkg.grandTotal))} · Photos ({pkg.photoCount}), Correspondence (
                  {pkg.correspondenceCount}), Day Works Sheets ({pkg.dayWorksSheetCount})
                </p>
                {(() => {
                  const excluded = PACKAGE_CATEGORIES.filter((category) => !pkg.includedCategories.includes(category));
                  return excluded.length > 0 ? (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Excluded from this package: {excluded.map((category) => PACKAGE_CATEGORY_LABELS[category]).join(", ")}
                    </p>
                  ) : (
                    <p className="text-xs text-[#4c739a] dark:text-slate-400">All categories included</p>
                  );
                })()}
              </div>
              <a
                href={`/api/projects/${projectId}/variation-items/${itemId}/packages/${pkg.id}/file`}
                target="_blank"
                rel="noreferrer"
                className="h-8 px-3 flex items-center rounded-lg border border-[#e7edf3] dark:border-slate-700 text-xs font-bold hover:bg-[#e7edf3] dark:hover:bg-slate-800 shrink-0"
              >
                Download
              </a>
            </div>
          ))}
        </div>
      )}

      {isReviewOpen && (
        <GeneratePackageReviewDialog
          projectId={projectId}
          itemId={itemId}
          item={item}
          dayWorksSheets={dayWorksSheets}
          photos={photos}
          correspondence={correspondence}
          updates={updates}
          contractTerms={contractTerms}
          onClose={() => setIsReviewOpen(false)}
          onGenerated={() => {
            setIsReviewOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
