import type {
  ContractItem,
  ContractItemComponent,
  ContractItemComponentPhase,
  ContractItemProgressEntry,
  ContractSchedule
} from "@prisma/client";
import { prisma } from "./prisma";

// ============================================================
// The calculation engine behind the Contract Schedule of Values (Appendix
// B2's equivalent) — reads the dated %-checkpoint history recorded against
// each fixed component's phase(s) and each weekly_hire component, and turns
// it into real claimable dollar amounts for a given claim period.
//
// Two aggregations over the SAME checkpoint shape, because the two kinds
// of value accrue differently in real life:
//   - a fixed phase (Supply/Install/Erect/Dismantle/Remove/Transport/etc.)
//     is read POINT-IN-TIME: whatever % the latest checkpoint on or before
//     the date in question says.
//   - a weekly_hire component is read as a DAY-WEIGHTED SUM across the
//     claim period: every day accrues (weekly rate ÷ 7) × that day's %,
//     and a change mid-period is honoured exactly on the date it took
//     effect — this is the piece the subbie's own Excel template
//     couldn't do (its own header literally says "Date Range (If % on
//     hire changes during month)" with nowhere to actually enter it).
// ============================================================

export type ProgressCheckpoint = { effectiveDate: Date; percent: number };

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function sortCheckpoints(checkpoints: ProgressCheckpoint[]): ProgressCheckpoint[] {
  return [...checkpoints].sort((a, b) => a.effectiveDate.getTime() - b.effectiveDate.getTime());
}

// The applicable % on a given day: whatever the latest checkpoint dated on
// or before that day says, 0% if the day is before every checkpoint (or
// there are none at all). `sorted` must already be ascending by date.
function percentOnDay(sorted: ProgressCheckpoint[], day: Date): number {
  let result = 0;
  for (const checkpoint of sorted) {
    if (checkpoint.effectiveDate.getTime() <= day.getTime()) {
      result = checkpoint.percent;
    } else {
      break;
    }
  }
  return result;
}

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

// The point-in-time % complete of a single phase, as of a given date —
// used both to value a fixed component and to show "current %" in the UI.
export function resolvePhasePercent(checkpoints: ProgressCheckpoint[], asOfDate: Date): number {
  return percentOnDay(sortCheckpoints(checkpoints), startOfDay(asOfDate));
}

// A fixed component's claimable value as of a date: the amount, split
// across its phases by each phase's share, each phase valued at its own
// point-in-time % complete. A single-phase "Supply only" component (one
// phase at 100% share) collapses to the familiar amount × %complete.
export function computeFixedComponentValue(
  amount: number,
  phases: { sharePercent: number; checkpoints: ProgressCheckpoint[] }[],
  asOfDate: Date
): number {
  let total = 0;
  for (const phase of phases) {
    const percent = resolvePhasePercent(phase.checkpoints, asOfDate);
    total += amount * (phase.sharePercent / 100) * (percent / 100);
  }
  return round2(total);
}

// A weekly_hire component's day-weighted value across an arbitrary window
// (inclusive of both ends) — the primitive both "this claim's amount"
// (window = the claim period) and "claimed to date" (window = from the
// very first checkpoint's date to the claim's period-end) are built from.
// Walks day-by-day rather than run-length-encoding the checkpoints: at
// realistic claim-period lengths (weeks to a few years) this is fast
// enough, and a plain day loop is far easier to independently verify by
// hand than a cleverer segment-merging version would be — see this
// feature's verification script, which does exactly that by hand for the
// worked facade-handover example this was built against.
export function computeRentalValueForPeriod(
  weeklyRate: number,
  checkpoints: ProgressCheckpoint[],
  periodStart: Date,
  periodEnd: Date
): number {
  const sorted = sortCheckpoints(checkpoints);
  if (sorted.length === 0) return 0;

  const dailyRate = weeklyRate / 7;
  let total = 0;
  const start = startOfDay(periodStart);
  const end = startOfDay(periodEnd);
  for (let day = start; day.getTime() <= end.getTime(); day = addDays(day, 1)) {
    const percent = percentOnDay(sorted, day);
    if (percent > 0) total += dailyRate * (percent / 100);
  }
  return round2(total);
}

// "Claimed to date" for a weekly_hire component — the same day-weighted
// sum, but from the very first checkpoint ever recorded through to the
// given date, regardless of how many separate claim periods that spans.
export function computeRentalClaimedToDate(weeklyRate: number, checkpoints: ProgressCheckpoint[], asOfDate: Date): number {
  const sorted = sortCheckpoints(checkpoints);
  if (sorted.length === 0) return 0;
  return computeRentalValueForPeriod(weeklyRate, sorted, sorted[0].effectiveDate, asOfDate);
}

// ============================================================
// Prisma-shaped rollups — the read side the UI and Payment Claims page
// actually call, wrapping the pure functions above around real component/
// phase rows.
// ============================================================

export type ComponentWithProgress = ContractItemComponent & {
  phases: (ContractItemComponentPhase & { progressEntries: ContractItemProgressEntry[] })[];
  progressEntries: ContractItemProgressEntry[];
};
export type ItemWithComponents = ContractItem & { components: ComponentWithProgress[] };
export type ScheduleWithItems = ContractSchedule & { items: ItemWithComponents[] };

function toCheckpoints(entries: ContractItemProgressEntry[]): ProgressCheckpoint[] {
  return entries.map((entry) => ({ effectiveDate: entry.effectiveDate, percent: entry.percent }));
}

export type ComponentValueBreakdown = {
  componentId: string;
  label: string;
  kind: ContractItemComponent["kind"];
  claimedToDate: number;
  previousClaimedToDate: number;
  thisClaimAmount: number;
};

export type ContractItemValueBreakdown = {
  itemId: string;
  description: string;
  components: ComponentValueBreakdown[];
};

// The full per-item, per-component breakdown for one claim period —
// `previousPeriodEnd` is null for a project's very first claim (so
// "previous claimed to date" is 0 for every component). Fixed components
// are read point-in-time at each of the two dates and the claim amount is
// the difference; weekly_hire components are read directly over each
// window (this claim = the period itself; claimed to date = since the
// very first checkpoint), which gives the identical answer without ever
// relying on subtraction landing on exactly the right value by luck.
export function computeScheduleClaimBreakdown(
  schedule: ScheduleWithItems,
  periodStart: Date,
  periodEnd: Date,
  previousPeriodEnd: Date | null
): ContractItemValueBreakdown[] {
  return schedule.items.map((item) => ({
    itemId: item.id,
    description: item.description,
    components: item.components.map((component) => {
      if (component.kind === "weekly_hire") {
        const checkpoints = toCheckpoints(component.progressEntries);
        const rate = Number(component.weeklyRate ?? 0);
        const claimedToDate = computeRentalClaimedToDate(rate, checkpoints, periodEnd);
        const previousClaimedToDate = previousPeriodEnd ? computeRentalClaimedToDate(rate, checkpoints, previousPeriodEnd) : 0;
        return {
          componentId: component.id,
          label: component.label,
          kind: component.kind,
          claimedToDate,
          previousClaimedToDate,
          thisClaimAmount: computeRentalValueForPeriod(rate, checkpoints, periodStart, periodEnd)
        };
      }

      const amount = Number(component.amount ?? 0);
      const phases = component.phases.map((phase) => ({
        sharePercent: phase.sharePercent,
        checkpoints: toCheckpoints(phase.progressEntries)
      }));
      const claimedToDate = computeFixedComponentValue(amount, phases, periodEnd);
      const previousClaimedToDate = previousPeriodEnd ? computeFixedComponentValue(amount, phases, previousPeriodEnd) : 0;
      return {
        componentId: component.id,
        label: component.label,
        kind: component.kind,
        claimedToDate,
        previousClaimedToDate,
        thisClaimAmount: round2(claimedToDate - previousClaimedToDate)
      };
    })
  }));
}

export function sumBreakdown(breakdown: ContractItemValueBreakdown[]): { claimedToDate: number; thisClaim: number } {
  let claimedToDate = 0;
  let thisClaim = 0;
  for (const item of breakdown) {
    for (const component of item.components) {
      claimedToDate += component.claimedToDate;
      thisClaim += component.thisClaimAmount;
    }
  }
  return { claimedToDate: round2(claimedToDate), thisClaim: round2(thisClaim) };
}

// The schedule's total contract value — "Original Subcontract Sum"
// (Appendix B1 line 1). Fixed components contribute their priced amount
// directly; a weekly_hire component has no natural closing total (rental
// is open-ended by nature), so it contributes the quote's OWN originally
// assumed total (rate × quoted duration) purely for this one summary
// figure — actual claiming never uses quotedDurationWeeks, only the real
// dated checkpoint history (see computeRentalValueForPeriod above).
export function computeScheduleTotalValue(schedule: ScheduleWithItems): number {
  let total = 0;
  for (const item of schedule.items) {
    for (const component of item.components) {
      if (component.kind === "weekly_hire") {
        const rate = Number(component.weeklyRate ?? 0);
        const weeks = component.quotedDurationWeeks ?? 0;
        total += rate * weeks;
      } else {
        total += Number(component.amount ?? 0);
      }
    }
  }
  return round2(total);
}

// Fetches a project's schedule with everything the calculations above
// need, in one query — the shape every caller (the schedule page, Payment
// Claims) wants.
export async function getContractScheduleForProject(projectId: string): Promise<ScheduleWithItems | null> {
  return prisma.contractSchedule.findUnique({
    where: { projectId },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        include: {
          components: {
            orderBy: { sortOrder: "asc" },
            include: {
              phases: {
                orderBy: { sortOrder: "asc" },
                include: { progressEntries: { orderBy: { effectiveDate: "asc" } } }
              },
              progressEntries: { orderBy: { effectiveDate: "asc" } }
            }
          }
        }
      }
    }
  });
}

// Validates a fixed component's phase shares sum to 100 (within floating-
// point tolerance) — called from the API routes before saving, not
// enforced at the database level (this codebase's established convention
// for cross-row invariants like this — see PaymentClaim.claimedAmount's
// own schema comment).
export function validatePhaseShares(phases: { sharePercent: number }[]): string | null {
  if (phases.length === 0) return "At least one phase is required.";
  const total = phases.reduce((sum, phase) => sum + phase.sharePercent, 0);
  if (Math.abs(total - 100) > 0.01) {
    return `Phase shares must add up to 100% (currently ${round2(total)}%).`;
  }
  return null;
}

export type ContractItemComponentInput = {
  kind: "fixed" | "weekly_hire";
  label: string;
  sortOrder?: number;
  amount?: number | null;
  weeklyRate?: number | null;
  quotedDurationWeeks?: number | null;
  phases?: { label: string; sharePercent: number; sortOrder?: number }[];
};
export type ContractItemInput = {
  description: string;
  sectionLabel?: string | null;
  sortOrder?: number;
  components: ContractItemComponentInput[];
};

// The one nested-create mapping from the input shape above to Prisma's
// nested-write shape — shared by the plain "add one item" route and the
// Phase 2 quote-extraction confirm route, so a bulk create from an
// extraction never has to duplicate (and risk drifting from) the same
// logic a manual add already uses.
export function buildContractItemCreateData(scheduleId: string, item: ContractItemInput, sortOrder: number) {
  return {
    scheduleId,
    description: item.description,
    sectionLabel: item.sectionLabel || null,
    sortOrder: item.sortOrder ?? sortOrder,
    components: {
      create: item.components.map((component, index) => ({
        kind: component.kind,
        label: component.label,
        sortOrder: component.sortOrder ?? index,
        amount: component.kind === "fixed" ? component.amount : null,
        weeklyRate: component.kind === "weekly_hire" ? component.weeklyRate : null,
        quotedDurationWeeks: component.kind === "weekly_hire" ? component.quotedDurationWeeks : null,
        phases:
          component.kind === "fixed"
            ? {
                create: (component.phases ?? []).map((phase, phaseIndex) => ({
                  label: phase.label,
                  sharePercent: phase.sharePercent,
                  sortOrder: phase.sortOrder ?? phaseIndex
                }))
              }
            : undefined
      }))
    }
  };
}
