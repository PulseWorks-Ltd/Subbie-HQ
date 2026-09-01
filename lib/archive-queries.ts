import { prisma } from "./prisma";
import { archiveMonthFor } from "./variation-item-lifecycle";

// "The folders are views over data" — nothing here ever copies a record
// into a month. Every function below is a pure query against the existing
// tables, filtered/grouped by whichever month field is relevant to that
// record type. Site Instructions/Variations can appear under more than one
// month (their creation month, plus any month they were referenced by a Day
// Works sheet, a Task, or a claim allocation) — that's the multi-month
// reference model, not duplication: opening the SAME record from two
// different months in the archive returns the exact same row.

export const ARCHIVE_RECORD_TYPES = [
  "site_instructions",
  "variations",
  "day_works",
  "tasks",
  "claims",
  "project_diary"
] as const;
export type ArchiveRecordType = (typeof ARCHIVE_RECORD_TYPES)[number];

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// All months with ANY activity for this project, across every record type —
// drives the Year -> Month navigation. Computed by fetching just the date
// columns (bounded per project, not per organisation/globally) and
// aggregating in application code, matching this build's "computed, not a
// separately-maintained index" approach elsewhere (archive month, SI
// reference matching). If a project's history grows large enough that this
// becomes slow, the natural next step is a DB-level GROUP BY on the same
// fields — noted as a scaling follow-up, not needed at today's volumes.
export async function getArchiveMonths(projectId: string): Promise<string[]> {
  const [items, sheets, tasks, claims, diaryEntries] = await Promise.all([
    prisma.variationItem.findMany({
      where: { projectId },
      select: { id: true, createdAt: true, variationCreatedAt: true, closedAt: true }
    }),
    prisma.dayWorksSheet.findMany({ where: { variationItem: { projectId } }, select: { createdAt: true } }),
    prisma.task.findMany({ where: { projectId }, select: { createdAt: true } }),
    prisma.paymentClaim.findMany({ where: { projectId }, select: { claimMonth: true } }),
    prisma.update.findMany({ where: { projectId, parentId: null }, select: { createdAt: true } })
  ]);

  const months = new Set<string>();
  for (const item of items) {
    months.add(monthKey(item.createdAt));
    if (item.variationCreatedAt) months.add(monthKey(item.variationCreatedAt));
  }
  for (const sheet of sheets) months.add(monthKey(sheet.createdAt));
  for (const task of tasks) months.add(monthKey(task.createdAt));
  for (const claim of claims) months.add(claim.claimMonth);
  for (const entry of diaryEntries) months.add(monthKey(entry.createdAt));

  // Closed items file under their (possibly later) archive month too.
  const closedIds = items.filter((i) => i.closedAt).map((i) => i.id);
  for (const id of closedIds) {
    const archived = await archiveMonthFor(id);
    if (archived) months.add(archived);
  }

  return [...months].sort().reverse();
}

export function yearsFromMonths(months: string[]): string[] {
  return [...new Set(months.map((m) => m.slice(0, 4)))].sort().reverse();
}

export function monthsForYear(months: string[], year: string): string[] {
  return months.filter((m) => m.startsWith(year)).sort().reverse();
}

type ArchiveRow = { id: string; reference?: string; title: string; href: string; closed: boolean };

// One month, one record type — reused directly by the Archive UI's
// Year/Month/Type drill-down. `month` is "YYYY-MM".
export async function getArchiveRecordsForMonth(
  projectId: string,
  month: string,
  recordType: ArchiveRecordType
): Promise<ArchiveRow[]> {
  const [year, mm] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, mm - 1, 1));
  const end = new Date(Date.UTC(year, mm, 1));

  switch (recordType) {
    case "site_instructions":
    case "variations": {
      const isVariation = recordType === "variations";
      const items = await prisma.variationItem.findMany({
        where: {
          projectId,
          ...(isVariation ? { variationCreatedAt: { not: null } } : { type: "site_instruction" }),
          OR: [
            isVariation ? { variationCreatedAt: { gte: start, lt: end } } : { createdAt: { gte: start, lt: end } },
            { dayWorksSheets: { some: { createdAt: { gte: start, lt: end } } } },
            { tasks: { some: { createdAt: { gte: start, lt: end } } } },
            { claimAllocations: { some: { paymentClaim: { claimMonth: month } } } }
          ]
        },
        select: { id: true, reference: true, title: true, closedAt: true }
      });
      // Closed items are also included if THIS month is their current
      // computed archive month (covers the case where nothing else in the
      // OR above matched but the fallback creation-month archive rule
      // applies).
      const closedCandidates = await prisma.variationItem.findMany({
        where: { projectId, closedAt: { not: null }, ...(isVariation ? { variationCreatedAt: { not: null } } : { type: "site_instruction" }) },
        select: { id: true, reference: true, title: true, closedAt: true }
      });
      const alreadyIncluded = new Set(items.map((i) => i.id));
      for (const candidate of closedCandidates) {
        if (alreadyIncluded.has(candidate.id)) continue;
        if ((await archiveMonthFor(candidate.id)) === month) {
          items.push(candidate);
          alreadyIncluded.add(candidate.id);
        }
      }
      return items.map((i) => ({
        id: i.id,
        reference: i.reference,
        title: i.title,
        href: `/projects/${projectId}/variations/${i.id}`,
        closed: i.closedAt != null
      }));
    }

    case "day_works": {
      const sheets = await prisma.dayWorksSheet.findMany({
        where: { variationItem: { projectId }, createdAt: { gte: start, lt: end } },
        select: { id: true, fileName: true, variationItemId: true, variationItem: { select: { reference: true, closedAt: true } } }
      });
      return sheets.map((s) => ({
        id: s.id,
        reference: s.variationItem.reference,
        title: s.fileName,
        href: `/projects/${projectId}/variations/${s.variationItemId}`,
        closed: s.variationItem.closedAt != null
      }));
    }

    case "tasks": {
      const tasks = await prisma.task.findMany({
        where: { projectId, createdAt: { gte: start, lt: end } },
        select: { id: true, title: true, status: true }
      });
      return tasks.map((t) => ({
        id: t.id,
        title: t.title,
        href: `/projects/${projectId}/tasks#${t.id}`,
        closed: t.status === "closed"
      }));
    }

    case "claims": {
      const claims = await prisma.paymentClaim.findMany({
        where: { projectId, claimMonth: month },
        select: { id: true, claimNumber: true, status: true }
      });
      return claims.map((c) => ({
        id: c.id,
        reference: `Claim #${c.claimNumber}`,
        title: `Claim #${c.claimNumber}`,
        href: `/projects/${projectId}/payment-claims#${c.id}`,
        closed: c.status === "responded"
      }));
    }

    case "project_diary": {
      const entries = await prisma.update.findMany({
        where: { projectId, parentId: null, createdAt: { gte: start, lt: end } },
        select: { id: true, body: true }
      });
      return entries.map((e) => ({
        id: e.id,
        title: e.body.length > 80 ? `${e.body.slice(0, 80)}...` : e.body || "(no text)",
        href: `/projects/${projectId}/updates#${e.id}`,
        closed: false
      }));
    }
  }
}
