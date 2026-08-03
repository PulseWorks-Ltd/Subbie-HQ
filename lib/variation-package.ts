import type { ContractTerms, DayWorksMaterial, DayWorksPlant, DayWorksSheet, DayWorksSheetRecord } from "@prisma/client";

export type DayWorksSheetWithLineItems = DayWorksSheet & {
  materials: DayWorksMaterial[];
  plant: DayWorksPlant[];
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

export type SheetTotals = {
  labour: LabourSummary;
  materialsCost: number;
  materialsMarkupAmount: number;
  plantCost: number;
  combinedTotal: number;
};

// Single source of truth for "what does one Day Works Sheet cost" — used
// by the sheet's own display, the Variation Package review screen, PDF
// generation, and the totals frozen onto a generated VariationPackage.
// Combined total = labour (priced records only) + materials + materials
// markup + plant (unmarked-up).
export function computeSheetTotals(sheet: DayWorksSheetWithLineItems, contractTerms: RateFields | null): SheetTotals {
  const labour = computeLabourSummary(sheet.sheetRecords);
  const materialsCost = computeMaterialsCost(sheet.materials);
  const markupPercent = contractTerms?.materialsMarkupPercent ?? null;
  const materialsMarkupAmount = markupPercent != null ? materialsCost * (markupPercent / 100) : 0;
  const plantCost = computePlantCost(sheet.plant);
  const combinedTotal = labour.total + materialsCost + materialsMarkupAmount + plantCost;

  return { labour, materialsCost, materialsMarkupAmount, plantCost, combinedTotal };
}

export type PackageTotals = {
  labourTotal: number;
  materialsTotal: number;
  materialsMarkupTotal: number;
  plantTotal: number;
  grandTotal: number;
};

// Sums computeSheetTotals across every Day Works Sheet attached to a
// Variation/SI — this is exactly what gets frozen onto a generated
// VariationPackage's totals columns, and what a future Payment Claims
// module aggregates across many variations.
export function computePackageTotals(sheets: DayWorksSheetWithLineItems[], contractTerms: RateFields | null): PackageTotals {
  let labourTotal = 0;
  let materialsTotal = 0;
  let materialsMarkupTotal = 0;
  let plantTotal = 0;

  for (const sheet of sheets) {
    const totals = computeSheetTotals(sheet, contractTerms);
    labourTotal += totals.labour.total;
    materialsTotal += totals.materialsCost;
    materialsMarkupTotal += totals.materialsMarkupAmount;
    plantTotal += totals.plantCost;
  }

  return {
    labourTotal,
    materialsTotal,
    materialsMarkupTotal,
    plantTotal,
    grandTotal: labourTotal + materialsTotal + materialsMarkupTotal + plantTotal
  };
}
