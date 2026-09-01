import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, requireUserId } from "@/lib/auth";

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  variationItemId: z.string().optional(),
  dueAt: z.string().datetime().optional()
});

// No dedicated permission module — Tasks are cross-cutting (optionally
// linked to any Variation/SI) and gated by plain project access only, same
// default as the Dashboard's project-wide feed.
export async function GET(request: Request, context: { params: { projectId: string } }) {
  const userId = await requireUserId(request);
  const { projectId } = context.params;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireProjectAccess(projectId, userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const tasks = await prisma.task.findMany({
    where: { projectId },
    include: { variationItem: { select: { id: true, reference: true, title: true } } },
    orderBy: { createdAt: "desc" }
  });
  return NextResponse.json({ tasks });
}

export async function POST(request: Request, context: { params: { projectId: string } }) {
  const userId = await requireUserId(request);
  const { projectId } = context.params;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireProjectAccess(projectId, userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = createTaskSchema.parse(await request.json());

  if (payload.variationItemId) {
    const item = await prisma.variationItem.findFirst({ where: { id: payload.variationItemId, projectId } });
    if (!item) return NextResponse.json({ error: "Linked item not found in this project." }, { status: 400 });
  }

  const task = await prisma.task.create({
    data: {
      projectId,
      title: payload.title,
      description: payload.description,
      variationItemId: payload.variationItemId,
      dueAt: payload.dueAt ? new Date(payload.dueAt) : undefined,
      createdByUserId: userId
    },
    include: { variationItem: { select: { id: true, reference: true, title: true } } }
  });

  return NextResponse.json({ task }, { status: 201 });
}
