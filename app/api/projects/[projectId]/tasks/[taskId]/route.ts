import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, requireUserId } from "@/lib/auth";
import { completeTask, closeTask, reactivateTask } from "@/lib/task-lifecycle";

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  variationItemId: z.string().optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
  // Lifecycle transitions — status is never set directly to "in_progress"
  // via a raw field here (that's a plain, no-side-effect move covered
  // below); complete/close/reactivate go through lib/task-lifecycle.ts so
  // they're logged.
  moveToInProgress: z.boolean().optional(),
  complete: z.boolean().optional(),
  close: z.boolean().optional(),
  reactivate: z.boolean().optional(),
  note: z.string().optional()
});

export async function PATCH(request: Request, context: { params: { projectId: string; taskId: string } }) {
  const userId = await requireUserId(request);
  const { projectId, taskId } = context.params;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireProjectAccess(projectId, userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const task = await prisma.task.findFirst({ where: { id: taskId, projectId } });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const payload = updateTaskSchema.parse(await request.json());

  if (payload.complete) {
    await completeTask({ taskId, userId, note: payload.note });
  } else if (payload.close) {
    await closeTask({ taskId, userId, note: payload.note });
  } else if (payload.reactivate) {
    await reactivateTask({ taskId, userId, note: payload.note });
  } else if (payload.moveToInProgress) {
    await prisma.task.update({ where: { id: taskId }, data: { status: "in_progress" } });
  } else {
    await prisma.task.update({
      where: { id: taskId },
      data: {
        title: payload.title,
        description: payload.description,
        variationItemId: payload.variationItemId,
        dueAt: payload.dueAt ? new Date(payload.dueAt) : payload.dueAt === null ? null : undefined
      }
    });
  }

  const updated = await prisma.task.findUnique({
    where: { id: taskId },
    include: { variationItem: { select: { id: true, reference: true, title: true } } }
  });
  return NextResponse.json({ task: updated });
}
