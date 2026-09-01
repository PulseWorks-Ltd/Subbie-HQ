import { prisma } from "./prisma";
import { recordLifecycleEvent } from "./record-lifecycle-log";

// Task's lifecycle has no claim-balance/Day-Works checks like a
// VariationItem's does — just the plain status progression, with
// Completed and Closed deliberately kept as two separate, non-automatic
// transitions (see Task's schema comment): reaching `completed` never by
// itself sets `closedAt`.
export async function completeTask(params: { taskId: string; userId: string; note?: string }): Promise<void> {
  const task = await prisma.task.findUniqueOrThrow({ where: { id: params.taskId }, select: { status: true } });
  await prisma.task.update({ where: { id: params.taskId }, data: { status: "completed", completedAt: new Date() } });
  await recordLifecycleEvent({
    entityType: "task",
    entityId: params.taskId,
    eventType: "completed",
    userId: params.userId,
    previousState: task.status,
    newState: "completed",
    note: params.note ?? null
  });
}

export async function closeTask(params: { taskId: string; userId: string; note?: string }): Promise<void> {
  const task = await prisma.task.findUniqueOrThrow({ where: { id: params.taskId }, select: { status: true } });
  await prisma.task.update({
    where: { id: params.taskId },
    data: { status: "closed", closedAt: new Date(), closedByUserId: params.userId }
  });
  await recordLifecycleEvent({
    entityType: "task",
    entityId: params.taskId,
    eventType: "closed",
    userId: params.userId,
    previousState: task.status,
    newState: "closed",
    note: params.note ?? null
  });
}

export async function reactivateTask(params: { taskId: string; userId: string; note?: string }): Promise<void> {
  const task = await prisma.task.findUniqueOrThrow({ where: { id: params.taskId }, select: { status: true } });
  await prisma.task.update({ where: { id: params.taskId }, data: { status: "open", closedAt: null, closedByUserId: null } });
  await recordLifecycleEvent({
    entityType: "task",
    entityId: params.taskId,
    eventType: "reactivated",
    userId: params.userId,
    previousState: task.status,
    newState: "open",
    note: params.note ?? null
  });
}
