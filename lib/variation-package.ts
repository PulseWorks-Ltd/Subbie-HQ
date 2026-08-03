import type { ContractTerms, DayWorksLabourEntry, DayWorksMaterial, DayWorksPlant, DayWorksSheet } from "@prisma/client";
import { summariseLabourCost, type LabourCostSummary } from "./day-works-rates";

export type DayWorksSheetWithLineItems = DayWorksSheet & {
  materials: DayWorksMaterial[];
  plant: DayWorksPlant[];
  labourEntries: DayWorksLabourEntry[];
};

type RateFields = Pick<ContractTerms, "dayWorksRateNormal" | "dayWorksRateNight" | "dayWorksRateSundayHoliday" | "materialsMarkupPercent">;

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

export type SheetTotals = {
  labourSummary: LabourCostSummary;
  materialsCost: number;
  materialsMarkupAmount: number;
  plantCost: number;
  combinedTotal: number;
};

// Single source of truth for "what does one Day Works Sheet cost" — used
// by the sheet's own display, the Variation Package review screen, PDF
// generation, and the totals frozen onto a generated VariationPackage.
// Combined total = labour (priced portion only, see summariseLabourCost)
// + materials + materials markup + plant (unmarked-up).
export function computeSheetTotals(sheet: DayWorksSheetWithLineItems, contractTerms: RateFields | null): SheetTotals {
  const labourSummary = summariseLabourCost(
    sheet.labourEntries.map((entry) => ({ hours: Number(entry.hours), rateType: entry.rateType })),
    contractTerms
  );
  const materialsCost = computeMaterialsCost(sheet.materials);
  const markupPercent = contractTerms?.materialsMarkupPercent ?? null;
  const materialsMarkupAmount = markupPercent != null ? materialsCost * (markupPercent / 100) : 0;
  const plantCost = computePlantCost(sheet.plant);
  const combinedTotal = labourSummary.totalPricedCost + materialsCost + materialsMarkupAmount + plantCost;

  return { labourSummary, materialsCost, materialsMarkupAmount, plantCost, combinedTotal };
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
    labourTotal += totals.labourSummary.totalPricedCost;
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
