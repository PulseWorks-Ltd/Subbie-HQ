import { NextResponse } from "next/server";
import { z } from "zod";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createDelayEvent } from "@/lib/delay-events";

export async function GET(request: Request, context: { params: { projectId: string } }) {
  const userId = await requireUserId(request);
  const { projectId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const canAccessModule = await requireModuleAccess(projectId, userId, "delay_events");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const delayEvents = await prisma.delayEvent.findMany({
    where: { projectId },
    include: { variationItem: { select: { id: true, reference: true, title: true } } },
    orderBy: { startDate: "desc" }
  });

  return NextResponse.json({ delayEvents });
}

const createSchema = z.object({
  variationItemId: z.string().nullable().optional(),
  cause: z.string().min(1),
  clauseReference: z.string().nullable().optional(),
  startDate: z.string(),
  endDate: z.string().nullable().optional(),
  daysClaimed: z.number().int().nullable().optional(),
  noticeDeadlineOverride: z.string().nullable().optional()
});

export async function POST(request: Request, context: { params: { projectId: string } }) {
  const userId = await requireUserId(request);
  const { projectId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const canAccessModule = await requireModuleAccess(projectId, userId, "delay_events");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = createSchema.parse(await request.json());
  const startDate = new Date(payload.startDate);
  if (Number.isNaN(startDate.getTime())) {
    return NextResponse.json({ error: "Invalid start date." }, { status: 400 });
  }

  if (payload.variationItemId) {
    const item = await prisma.variationItem.findFirst({ where: { id: payload.variationItemId, projectId } });
    if (!item) {
      return NextResponse.json({ error: "Variation/Site Instruction not found." }, { status: 404 });
    }
  }

  const delayEvent = await createDelayEvent({
    projectId,
    variationItemId: payload.variationItemId,
    cause: payload.cause,
    clauseReference: payload.clauseReference,
    startDate,
    endDate: payload.endDate ? new Date(payload.endDate) : null,
    daysClaimed: payload.daysClaimed,
    noticeDeadlineOverride: payload.noticeDeadlineOverride ? new Date(payload.noticeDeadlineOverride) : null,
    createdByUserId: userId
  });

  return NextResponse.json({ delayEvent }, { status: 201 });
}
