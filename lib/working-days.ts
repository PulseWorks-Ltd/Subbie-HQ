// "Working day" = Monday-Friday, evaluated in UTC (dates in this app are
// stored/compared as UTC midnight, matching Prisma's DateTime handling
// elsewhere). This is distinct from lib/day-works-rates.ts's day-works
// labour rate concept, where Saturday counts as a normal (billable) work
// day and only Sunday gets the special rate — that file is about labour
// billing; this one is about contract deadline/notice-period scheduling,
// where Saturday and Sunday both don't count. Like that file, this doesn't
// attempt a full NZ/Aus public holiday calendar (neither Project nor
// Organisation has a region/jurisdiction field yet) — public holidays are
// simply treated as working days here, the same known limitation.
export function isWorkingDay(date: Date): boolean {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
}

function addUTCDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

// Steps back N working days from `target`, skipping weekends. `target`
// itself is never counted, even if it's a working day — e.g. N=2 stepping
// back from a Wednesday lands on the preceding Monday.
export function subtractWorkingDays(target: Date, n: number): Date {
  let current = new Date(target.getTime());
  let remaining = n;
  while (remaining > 0) {
    current = addUTCDays(current, -1);
    if (isWorkingDay(current)) remaining -= 1;
  }
  return current;
}

// Steps forward N working days from `start`, skipping weekends. `start`
// itself is never counted.
export function addWorkingDays(start: Date, n: number): Date {
  let current = new Date(start.getTime());
  let remaining = n;
  while (remaining > 0) {
    current = addUTCDays(current, 1);
    if (isWorkingDay(current)) remaining -= 1;
  }
  return current;
}

// If `date` falls on a weekend, rolls back to the preceding working day
// (Friday). Used for the "fixed calendar date" schedule type — e.g. a
// contract that says "the 20th of each month" when the 20th falls on a
// Saturday. Returns `date` unchanged if it's already a working day.
export function rollBackToWorkingDay(date: Date): Date {
  let current = new Date(date.getTime());
  while (!isWorkingDay(current)) {
    current = addUTCDays(current, -1);
  }
  return current;
}
