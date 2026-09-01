import { prisma } from "./prisma";
import { recordLifecycleEvent } from "./record-lifecycle-log";

// Project.status stays a plain string column (see its schema comment —
// adding an enum would need a backfill migration against every existing
// row). This is the single place the allowed set is enforced in code.
export const PROJECT_STATUSES = ["active", "completed", "closed"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export type ProjectClosureReview = {
  siTotal: number;
  siClosed: number;
  variationTotal: number;
  variationApproved: number;
  variationPending: number;
  dayWorksTotal: number;
  dayWorksSigned: number;
  dayWorksAwaitingSignature: number;
  taskTotal: number;
  taskCompleted: number;
  taskOpen: number;
  claimsOutstanding: number;
  hasWarnings: boolean;
};

// Mirrors the brief's own worked example (24 SIs/24 closed; 18 Variations/
// 16 approved/2 pending; 34 Day Works/33 signed/1 awaiting; 42 Tasks/40
// completed/2 open; Claims #01-#10/#10 outstanding) — one rollup query per
// project, reused by both the Complete and Close actions' warning dialog.
export async function reviewProjectForClosure(projectId: string): Promise<ProjectClosureReview> {
  const [items, sheets, tasks, claims] = await Promise.all([
    prisma.variationItem.findMany({
      where: { projectId },
      select: { type: true, status: true, closedAt: true, variationCreatedAt: true }
    }),
    prisma.dayWorksSheet.findMany({
      where: { variationItem: { projectId } },
      select: { externalActions: { select: { type: true, status: true } } }
    }),
    prisma.task.findMany({ where: { projectId }, select: { status: true } }),
    prisma.paymentClaim.findMany({ where: { projectId }, select: { status: true } })
  ]);

  const sis = items.filter((i) => i.type === "site_instruction");
  const variations = items.filter((i) => i.variationCreatedAt != null);

  const dayWorksSigned = sheets.filter((s) =>
    s.externalActions.some((a) => ["sign", "confirm"].includes(a.type) && a.status === "responded")
  ).length;
  const dayWorksAwaiting = sheets.filter((s) =>
    s.externalActions.some((a) => ["sign", "confirm"].includes(a.type) && a.status === "pending")
  ).length;

  const taskOpen = tasks.filter((t) => t.status === "open" || t.status === "in_progress").length;
  const taskCompleted = tasks.filter((t) => t.status === "completed" || t.status === "closed").length;

  const claimsOutstanding = claims.filter((c) => c.status !== "responded").length;

  const review: ProjectClosureReview = {
    siTotal: sis.length,
    siClosed: sis.filter((s) => s.closedAt != null).length,
    variationTotal: variations.length,
    variationApproved: variations.filter((v) => v.status === "complete").length,
    variationPending: variations.filter((v) => v.status !== "complete").length,
    dayWorksTotal: sheets.length,
    dayWorksSigned,
    dayWorksAwaitingSignature: dayWorksAwaiting,
    taskTotal: tasks.length,
    taskCompleted,
    taskOpen,
    claimsOutstanding,
    hasWarnings: false
  };

  review.hasWarnings =
    review.siTotal !== review.siClosed ||
    review.variationPending > 0 ||
    review.dayWorksAwaitingSignature > 0 ||
    review.taskOpen > 0 ||
    review.claimsOutstanding > 0;

  return review;
}

export async function completeProject(params: { projectId: string; userId: string; note?: string }): Promise<void> {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: params.projectId }, select: { status: true } });
  await prisma.project.update({ where: { id: params.projectId }, data: { status: "completed", completedAt: new Date() } });
  await recordLifecycleEvent({
    entityType: "project",
    entityId: params.projectId,
    eventType: "completed",
    userId: params.userId,
    previousState: project.status,
    newState: "completed",
    note: params.note ?? null
  });
}

export type ProjectCloseResult = { ok: true } | { ok: false; warnings: ProjectClosureReview };

export async function closeProject(params: {
  projectId: string;
  userId: string;
  force?: boolean;
  note?: string;
}): Promise<ProjectCloseResult> {
  const review = await reviewProjectForClosure(params.projectId);
  if (review.hasWarnings && !params.force) {
    return { ok: false, warnings: review };
  }

  const project = await prisma.project.findUniqueOrThrow({ where: { id: params.projectId }, select: { status: true } });
  await prisma.project.update({
    where: { id: params.projectId },
    data: { status: "closed", closedAt: new Date(), closedByUserId: params.userId }
  });

  const overrideSummary = review.hasWarnings
    ? `Closed with outstanding items: ${review.siTotal - review.siClosed} SI(s) open, ${review.variationPending} Variation(s) pending, ${review.dayWorksAwaitingSignature} Day Works awaiting signature, ${review.taskOpen} Task(s) open, ${review.claimsOutstanding} claim(s) outstanding`
    : null;

  await recordLifecycleEvent({
    entityType: "project",
    entityId: params.projectId,
    eventType: "closed",
    userId: params.userId,
    previousState: project.status,
    newState: "closed",
    note: params.note ?? overrideSummary
  });

  return { ok: true };
}
