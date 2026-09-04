import type { RetentionTimingUnit } from "@prisma/client";

// ============================================================
// Retention V2 — date calculation. See subbie-hq-retention-management-v2-
// plan.md §6.2/§6.3 for the full design and the honest limitation this
// module documents rather than papering over: confirmed by direct
// inspection that NO working-day arithmetic utility exists anywhere else
// in this codebase (lib/day-works-rates.ts's isRecognisedHolidayOrSunday
// only recognises Sundays, for Day Works rate selection — a different
// job entirely). This module does NOT attempt to solve the general NZ
// public-holiday-calendar problem (regional anniversary days genuinely
// vary by region and are real, ongoing maintenance work) — it recognises
// weekends plus a small, fixed table of NZ NATIONAL public holidays only,
// and every date this module computes must be shown to the user
// alongside that stated basis (see the Retention card), never presented
// as an unqualified fact.
// ============================================================

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

// A fixed, hard-coded table of NZ NATIONAL public holidays only —
// deliberately not regional anniversary days (Auckland Anniversary,
// Wellington Anniversary, etc.), which genuinely differ by region and
// are explicitly out of scope for this first pass (see this module's own
// header comment). Matariki's date changes each year by design (it's set
// by the Maramataka, not a fixed calendar rule) and is only reliably
// known a few years ahead — listed here only for the years it's
// officially gazetted; a year without an entry silently falls back to
// weekends-only for that single day, which is an honest, bounded gap,
// not a silent wrong answer for every other day.
const NZ_NATIONAL_PUBLIC_HOLIDAYS: Record<number, string[]> = {
  2024: ["2024-01-01", "2024-01-02", "2024-02-06", "2024-03-29", "2024-04-01", "2024-04-25", "2024-06-28", "2024-10-28", "2024-12-25", "2024-12-26"],
  2025: ["2025-01-01", "2025-01-02", "2025-02-06", "2025-04-18", "2025-04-21", "2025-04-25", "2025-06-20", "2025-10-27", "2025-12-25", "2025-12-26"],
  2026: ["2026-01-01", "2026-01-02", "2026-02-06", "2026-04-03", "2026-04-06", "2026-04-25", "2026-07-10", "2026-10-26", "2026-12-25", "2026-12-26"],
  2027: ["2027-01-01", "2027-01-04", "2027-02-08", "2027-03-26", "2027-03-29", "2027-04-25", "2027-06-25", "2027-10-25", "2027-12-25", "2027-12-27"],
  2028: ["2028-01-03", "2028-01-04", "2028-02-07", "2028-04-14", "2028-04-17", "2028-04-25", "2028-07-14", "2028-10-23", "2028-12-25", "2028-12-26"]
};

function isNzNationalPublicHoliday(date: Date): boolean {
  const year = date.getUTCFullYear();
  const iso = date.toISOString().slice(0, 10);
  return (NZ_NATIONAL_PUBLIC_HOLIDAYS[year] ?? []).includes(iso);
}

// The one non-working-day predicate this module ships by default —
// weekends plus NZ national public holidays (see the table's own
// comment for exactly what that does and doesn't cover). Exported so a
// caller can supply a different predicate (e.g. calendar-days-only, or a
// future region-aware one) without this module's other functions needing
// to change.
export function isNonWorkingDay(date: Date): boolean {
  return isWeekend(date) || isNzNationalPublicHoliday(date);
}

// Adds N working days to a date, per the supplied non-working-day
// predicate (defaults to isNonWorkingDay above). "From" itself is never
// counted — matches how every real contract clause of this shape is
// written ("N working days AFTER X"), and matches this exact wording in
// the SA-2017 baseline's own Specific Conditions Schedule ("22 Working
// Days after the end of the month in which...").
export function addWorkingDays(from: Date, days: number, isNonWorking: (d: Date) => boolean = isNonWorkingDay): Date {
  let result = startOfDay(from);
  let remaining = days;
  while (remaining > 0) {
    result = addDays(result, 1);
    if (!isNonWorking(result)) {
      remaining -= 1;
    }
  }
  return result;
}

// The last calendar day of the month containing `date` — the anchor the
// SA-2017 baseline's own retention clause uses ("22 Working Days after
// the end of the month in which the notice of completion... is issued").
export function endOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

export type RetentionTiming = { days: number | null; unit: RetentionTimingUnit | null };

// The single entry point every retention date calculation goes through —
// branches on the contract's own stated unit. `calendar_days` is a plain
// day offset; `weeks`/`months` are plain calendar arithmetic (the same
// kind of arithmetic Retention's own tranche-2-default and DelayEvent's
// computeNoticeDeadline already use elsewhere in this codebase);
// `working_days` is the one genuinely new capability (see addWorkingDays
// above). Returns null when no timing is stated at all — never guesses.
//
// Deliberately does NOT itself decide whether `triggerDate` should first
// be anchored to end-of-month — that's specific to how a particular
// contract phrases its own timing (see endOfMonth above, composed by the
// caller when the contract's own description says so), not a universal
// rule this function should silently apply.
export function computeReleaseDate(triggerDate: Date, timing: RetentionTiming | null | undefined): Date | null {
  if (!timing || timing.days == null || !timing.unit) return null;

  switch (timing.unit) {
    case "working_days":
      return addWorkingDays(triggerDate, timing.days);
    case "calendar_days":
      return addDays(startOfDay(triggerDate), timing.days);
    case "weeks":
      return addDays(startOfDay(triggerDate), timing.days * 7);
    case "months":
      return addMonths(startOfDay(triggerDate), timing.days);
  }
}
