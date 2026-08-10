import type { ContractTerms, DayWorksMaterial, DayWorksPlant, DayWorksSheet, DayWorksSheetRecord } from "@prisma/client";

// The 6 categories a Variation Package generation can include/exclude
// (per-generation only — see VariationPackage.includedCategories). Order
// matches the order these sections actually appear in the generated PDF
// (see lib/variation-package-pdf.ts). Shared between the review dialog,
// the generation API route, and the stored-package display so the set of
// valid keys only ever lives in one place. Materials/Plant split out of
// the old single "day_works_sheets" category (Labour, Plant & Material AI
// Extraction) — they're independent of any specific sheet now, so they
// need to be independently toggleable, not bundled with labour.
export const PACKAGE_CATEGORIES = [
  "quote",
  "day_works_sheets",
  "materials",
  "plant",
  "si_source_document",
  "correspondence",
  "linked_updates",
  "photos"
] as const;
export type PackageCategory = (typeof PACKAGE_CATEGORIES)[number];

export const PACKAGE_CATEGORY_LABELS: Record<PackageCategory, string> = {
  quote: "Quote",
  day_works_sheets: "Day Works Sheets (Labour)",
  materials: "Materials",
  plant: "Plant",
  si_source_document: "SI Source Document",
  correspondence: "Correspondence",
  linked_updates: "Linked Updates",
  photos: "Photos"
};

// Labour-only now — materials/plant are no longer nested under a sheet
// (Labour, Plant & Material AI Extraction). sheet.materials/sheet.plant
// still exist as a historical back-reference at the DB level (see
// prisma/schema.prisma), but nothing in business logic or the UI reads
// them through the sheet anymore; materials/plant are always item-level.
export type DayWorksSheetWithRecords = DayWorksSheet & {
  sheetRecords: DayWorksSheetRecord[];
};

type RateFields = Pick<ContractTerms, "materialsMarkupPercent">;

export function computeMaterialsCost(materials: DayWorksMaterial[]): number {
  return materials.reduce((sum, m) => sum + Number(m.quantity) * Number(m.unitCost), 0);
}

// Deliberately separate from computeMaterialsCost even though the maths is
// identical — Plant does NOT receive materialsMarkupPercent (Task 1.1),
// keeping these as two named call sites makes that scoping visible at
// every call site rather than relying on a shared "line item total"
// helper that a future edit could accidentally apply markup to.
export function computePlantCost(plant: DayWorksPlant[]): number {
  return plant.reduce((sum, p) => sum + Number(p.quantity) * Number(p.unitCost), 0);
}

export type MaterialsSummary = {
  materialsCost: number;
  materialsMarkupAmount: number;
};

// Markup applied ONCE to the item-level materials sum (Task 1.3) — not
// per-sheet, not per-line-item, since materials are no longer sheet-scoped.
export function computeMaterialsSummary(materials: DayWorksMaterial[], contractTerms: RateFields | null): MaterialsSummary {
  const materialsCost = computeMaterialsCost(materials);
  const markupPercent = contractTerms?.materialsMarkupPercent ?? null;
  const materialsMarkupAmount = markupPercent != null ? materialsCost * (markupPercent / 100) : 0;
  return { materialsCost, materialsMarkupAmount };
}

export type LabourSummary = {
  total: number;
  totalHours: number;
  hoursMissingRate: number;
};

// The single shared "what does one Day Works Sheet Record cost" formula —
// totalHours already represents the FULL CREW's hours, not one person's
// (see prisma/schema.prisma's comment on DayWorksSheetRecord and
// lib/grok.ts's extractDayWorksSheetSummariesFromImages, which resolves
// that value from the sheet's own stated crew total, falling back to
// crewSize × hoursPerPerson only when the sheet never stated one). Every
// consumer — the review dialog, this sheet's live display, the combined
// package totals, and the generated PDF — must go through this one
// function so they can never disagree. Accepts loosely-typed input
// (string | number | Decimal | null) since callers include both live
// Prisma records and string-valued form rows still being edited.
export function computeSheetRecordTotal(
  totalHours: unknown,
  ratePerHour: unknown
): number | null {
  if (totalHours == null || totalHours === "" || ratePerHour == null || ratePerHour === "") return null;
  const hours = Number(totalHours);
  const rate = Number(ratePerHour);
  if (!Number.isFinite(hours) || !Number.isFinite(rate)) return null;
  return hours * rate;
}

// Plain hours*rate sum per DayWorksSheetRecord, only when BOTH are
// present — a record missing either simply doesn't contribute a dollar
// figure (never a false $0), matching this simplified model's deliberate
// removal of any tiered-rate resolution (see prisma/schema.prisma's
// comment on DayWorksSheetRecord). hoursMissingRate surfaces hours that
// were recorded but can't yet be costed, for a "not costed" UI note.
export function computeLabourSummary(sheetRecords: DayWorksSheetRecord[]): LabourSummary {
  let total = 0;
  let totalHours = 0;
  let hoursMissingRate = 0;

  for (const record of sheetRecords) {
    const hours = record.totalHours != null ? Number(record.totalHours) : null;
    if (hours == null) continue;
    totalHours += hours;
    const recordTotal = computeSheetRecordTotal(record.totalHours, record.ratePerHour);
    if (recordTotal != null) {
      total += recordTotal;
    } else {
      hoursMissingRate += hours;
    }
  }

  return { total, totalHours, hoursMissingRate };
}

// Labour summed across EVERY sheet attached to the item — sheets
// themselves no longer carry materials/plant, so this is purely a
// flatten-and-reuse of computeLabourSummary across every sheet's records.
export function computeCombinedLabourSummary(sheets: DayWorksSheetWithRecords[]): LabourSummary {
  return computeLabourSummary(sheets.flatMap((sheet) => sheet.sheetRecords));
}

export type PackageTotals = {
  labourTotal: number;
  materialsTotal: number;
  materialsMarkupTotal: number;
  plantTotal: number;
  grandTotal: number;
};

// Single source of truth for "what does this Variation/SI's Labour,
// Materials & Plant cost, combined" (Task 1.3) — labour summed across
// every Day Works Sheet, materials/plant summed independently at the
// item level (no longer derived from within each sheet). Used by the
// section's live display, the Generate Variation Package review screen,
// PDF generation, and the totals frozen onto a generated VariationPackage.
export function computePackageTotals(
  sheets: DayWorksSheetWithRecords[],
  materials: DayWorksMaterial[],
  plant: DayWorksPlant[],
  contractTerms: RateFields | null
): PackageTotals {
  const labour = computeCombinedLabourSummary(sheets);
  const { materialsCost, materialsMarkupAmount } = computeMaterialsSummary(materials, contractTerms);
  const plantTotal = computePlantCost(plant);

  return {
    labourTotal: labour.total,
    materialsTotal: materialsCost,
    materialsMarkupTotal: materialsMarkupAmount,
    plantTotal,
    grandTotal: labour.total + materialsCost + materialsMarkupAmount + plantTotal
  };
}
