import { prisma } from "./prisma";

// "Hours on Site" — the live start/finish capture path (see
// HoursOnSiteSheet's schema comment for how this differs from the existing
// photographed-paper-sheet DayWorksSheet). Deliberately no payroll/award-
// rate/break-deduction/GPS logic anywhere in this file — this produces
// evidence (who was on site, for how long, against what work), not a
// timesheet system.

export async function startSheet(params: {
  projectId: string;
  variationItemId?: string;
  comments?: string;
  userId: string;
}) {
  return prisma.hoursOnSiteSheet.create({
    data: {
      projectId: params.projectId,
      variationItemId: params.variationItemId,
      comments: params.comments,
      startedAt: new Date(),
      createdByUserId: params.userId
    }
  });
}

// Sets finishedAt and computes totalHours from the startedAt/finishedAt
// delta, ONCE — this is a starting point for the user to correct, never
// recomputed automatically again afterward (see updateSheet below, which
// lets totalHours be overridden independently of the two timestamps).
export async function finishSheet(sheetId: string) {
  const sheet = await prisma.hoursOnSiteSheet.findUniqueOrThrow({ where: { id: sheetId } });
  if (sheet.approvedAt) throw new HoursOnSiteApprovedError();
  if (sheet.finishedAt) return sheet; // already finished — idempotent, no double-computation

  const finishedAt = new Date();
  const rawHours = (finishedAt.getTime() - sheet.startedAt.getTime()) / (1000 * 60 * 60);
  const totalHours = Math.round(Math.max(0, rawHours) * 100) / 100;

  return prisma.hoursOnSiteSheet.update({
    where: { id: sheetId },
    data: { finishedAt, totalHours }
  });
}

// Hours stay editable by the subcontractor right up until the sheet is
// approved via its secure external-action link (Req 6) — this is the one
// place startedAt/finishedAt/totalHours/comments ever change after
// creation, always a direct, explicit edit, never a recomputation the
// user didn't ask for. Once approvedAt is set the sheet is commercial
// evidence a Site Manager has signed off on, so every mutation below
// refuses rather than silently drifting the approved record.
export class HoursOnSiteApprovedError extends Error {
  constructor() {
    super("This sheet has been approved and can no longer be edited.");
    this.name = "HoursOnSiteApprovedError";
  }
}

async function assertNotApproved(sheetId: string) {
  const sheet = await prisma.hoursOnSiteSheet.findUniqueOrThrow({ where: { id: sheetId }, select: { approvedAt: true } });
  if (sheet.approvedAt) throw new HoursOnSiteApprovedError();
}

export async function updateSheet(
  sheetId: string,
  fields: { startedAt?: Date; finishedAt?: Date | null; totalHours?: number | null; comments?: string | null }
) {
  await assertNotApproved(sheetId);
  return prisma.hoursOnSiteSheet.update({ where: { id: sheetId }, data: fields });
}

export async function addWorkerToSheet(params: { sheetId: string; workerId: string }) {
  await assertNotApproved(params.sheetId);
  await prisma.hoursOnSiteWorker
    .create({ data: { sheetId: params.sheetId, workerId: params.workerId } })
    .catch(() => undefined); // unique constraint — already on the sheet, harmless no-op
}

export async function removeWorkerFromSheet(params: { sheetId: string; workerId: string }) {
  await assertNotApproved(params.sheetId);
  await prisma.hoursOnSiteWorker
    .delete({ where: { sheetId_workerId: { sheetId: params.sheetId, workerId: params.workerId } } })
    .catch(() => undefined);
}

// Finds an existing worker by exact name (case-insensitive) or creates a
// new one — the "type a new one-off" half of the search+select type-ahead,
// mirroring the same saved-or-one-off pattern used for contacts/recipients
// elsewhere in this app. Scoped to the project's own organisation (a
// subbie's crew, reusable across all its projects) — legacy org-less
// projects have no worker directory (nothing to scope it to), so those
// callers should treat an empty organisationId as "no directory available"
// rather than erroring.
export async function findOrCreateWorker(organisationId: string, name: string) {
  const trimmed = name.trim();
  const existing = await prisma.worker.findFirst({
    where: { organisationId, name: { equals: trimmed, mode: "insensitive" } }
  });
  if (existing) return existing;
  return prisma.worker.create({ data: { organisationId, name: trimmed } });
}

export async function searchWorkers(organisationId: string, query: string) {
  return prisma.worker.findMany({
    where: { organisationId, ...(query.trim() ? { name: { contains: query.trim(), mode: "insensitive" } } : {}) },
    orderBy: { name: "asc" },
    take: 20
  });
}

export async function getSheetWithDetail(sheetId: string) {
  return prisma.hoursOnSiteSheet.findUnique({
    where: { id: sheetId },
    include: {
      project: { select: { id: true, name: true } },
      variationItem: { select: { id: true, reference: true, title: true } },
      workers: { include: { worker: true } },
      createdByUser: { select: { firstName: true, lastName: true, email: true } }
    }
  });
}

// The active (started, not yet finished) sheet for this user on this
// project, if any — drives the mobile UI's "you have a session running"
// state so re-opening the app resumes it rather than losing track.
export async function getActiveSheet(projectId: string, userId: string) {
  return prisma.hoursOnSiteSheet.findFirst({
    where: { projectId, createdByUserId: userId, finishedAt: null },
    orderBy: { startedAt: "desc" }
  });
}

export async function listSheetsForProject(projectId: string) {
  return prisma.hoursOnSiteSheet.findMany({
    where: { projectId },
    include: {
      variationItem: { select: { id: true, reference: true, title: true } },
      workers: { include: { worker: true } }
    },
    orderBy: { startedAt: "desc" }
  });
}
