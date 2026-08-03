import type { ContractTerms } from "@prisma/client";

// Not a Prisma enum — DayWorksRateType (tiered normal/night/sunday_holiday
// rate resolution) was only ever a column type on the now-removed
// DayWorksLabourEntry model. Prisma doesn't generate a TS export for an
// enum no model field references, so this is a plain local type instead.
// This whole file is otherwise untouched and still fully functional —
// deliberately left in place, unused by the new per-sheet-summary flow,
// per this simplification's task notes (the product roadmap intends to
// reintroduce automatic rate selection later).
export type DayWorksRateType = "normal" | "night" | "sunday_holiday";

const NORMAL_START_HOUR = 7; // 7am
const NORMAL_END_HOUR = 17; // 5pm

// First-pass implementation: Sunday-only. Neither Project nor Organisation
// has a region/jurisdiction field yet (confirmed via a full repo grep), so
// there's no way to pick the correct NZ/Aus public holiday calendar for a
// given project. Flagging here rather than silently guessing one.
export function isRecognisedHolidayOrSunday(date: Date): boolean {
  return date.getUTCDay() === 0;
}

function parseTimeToHours(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours + minutes / 60;
}

export type RateSegment = { rateType: DayWorksRateType; hours: number };

// Splits one continuous start/end block into up to two segments (Normal +
// Night) proportioned by clock time on each side of the 7am/5pm boundary.
// Deliberately simple: doesn't handle a shift crossing midnight or more
// than one boundary — not realistic for a single day works sheet entry.
// Returns [] if the times can't be parsed or end isn't after start (caller
// should fall back to treating hours as unresolved / needing manual entry).
export function resolveRateSegments(date: Date, startTime: string, endTime: string): RateSegment[] {
  const start = parseTimeToHours(startTime);
  const end = parseTimeToHours(endTime);
  if (start === null || end === null || end <= start) return [];

  if (isRecognisedHolidayOrSunday(date)) {
    return [{ rateType: "sunday_holiday", hours: round2(end - start) }];
  }

  const normalStart = Math.max(start, NORMAL_START_HOUR);
  const normalEnd = Math.min(end, NORMAL_END_HOUR);
  const normalHours = Math.max(0, normalEnd - normalStart);
  const nightHours = end - start - normalHours;

  const segments: RateSegment[] = [];
  if (normalHours > 0) segments.push({ rateType: "normal", hours: round2(normalHours) });
  if (nightHours > 0) segments.push({ rateType: "night", hours: round2(nightHours) });
  return segments;
}

// Used when only a directly-stated total-hours figure is legible (no
// start/end time), so there's no clock time to split by — the date is all
// we have to go on. Genuinely ambiguous between Normal and Night for a
// weekday/Saturday entry with no time shown; defaults to Normal since
// that's the common case, but the review table lets the user correct the
// rate type for any entry before saving.
export function resolveRateTypeForHoursOnly(date: Date): DayWorksRateType {
  return isRecognisedHolidayOrSunday(date) ? "sunday_holiday" : "normal";
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

type RateFields = Pick<ContractTerms, "dayWorksRateNormal" | "dayWorksRateNight" | "dayWorksRateSundayHoliday">;

export function rateForType(contractTerms: RateFields | null, rateType: DayWorksRateType): number | null {
  if (!contractTerms) return null;
  const value =
    rateType === "normal"
      ? contractTerms.dayWorksRateNormal
      : rateType === "night"
        ? contractTerms.dayWorksRateNight
        : contractTerms.dayWorksRateSundayHoliday;
  return value === null ? null : Number(value);
}

export type LabourCostSummary = {
  hoursByType: Record<DayWorksRateType, number>;
  pricedCostByType: Partial<Record<DayWorksRateType, number>>;
  totalPricedCost: number;
  totalHours: number;
  unratedHours: number;
  anyRateConfigured: boolean;
};

// Degrades gracefully when some or all of the three rates aren't
// configured (Task rule: no rates set -> hours only, no dollar total).
// Hours whose rate type has no configured rate are tracked separately
// (unratedHours) rather than silently priced at 0, so the UI can show a
// "configure this rate to include these hours" prompt instead of an
// understated total.
export function summariseLabourCost(
  entries: { hours: number; rateType: DayWorksRateType }[],
  contractTerms: RateFields | null
): LabourCostSummary {
  const hoursByType: Record<DayWorksRateType, number> = { normal: 0, night: 0, sunday_holiday: 0 };
  for (const entry of entries) {
    hoursByType[entry.rateType] += entry.hours;
  }

  const anyRateConfigured = Boolean(
    contractTerms &&
      (contractTerms.dayWorksRateNormal != null ||
        contractTerms.dayWorksRateNight != null ||
        contractTerms.dayWorksRateSundayHoliday != null)
  );

  const pricedCostByType: Partial<Record<DayWorksRateType, number>> = {};
  let unratedHours = 0;
  (Object.keys(hoursByType) as DayWorksRateType[]).forEach((type) => {
    if (hoursByType[type] === 0) return;
    const rate = rateForType(contractTerms, type);
    if (rate != null) {
      pricedCostByType[type] = hoursByType[type] * rate;
    } else {
      unratedHours += hoursByType[type];
    }
  });

  const totalPricedCost = Object.values(pricedCostByType).reduce((sum: number, v) => sum + (v ?? 0), 0);
  const totalHours = hoursByType.normal + hoursByType.night + hoursByType.sunday_holiday;

  return { hoursByType, pricedCostByType, totalPricedCost, totalHours, unratedHours, anyRateConfigured };
}
