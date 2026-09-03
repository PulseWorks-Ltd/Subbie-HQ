import { NextResponse } from "next/server";
import { z } from "zod";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveDelayEvent } from "@/lib/delay-events";

// One route covers every post-creation edit: plain field edits (cause,
// dates, clause reference, days claimed, notice deadline override), and
// the two resolution outcomes (awarded/rejected, via resolveDelayEvent —
// see that function's own comment on why daysAwarded is a manual entry,
// not auto-captured from the ExternalAction response) plus a plain
// "closed" administrative status. Kept as one schema/handler rather than
// splitting resolution into its own route, since the Contract Schedule
// item-edit route already established "one PATCH, whichever fields are
// present" as this codebase's convention for a small, single-owner row
// like this.
const patchSchema = z.object({
  cause: z.string().min(1).optional(),
  clauseReference: z.string().nullable().optional(),
  startDate: z.string().optional(),
  endDate: z.string().nullable().optional(),
  daysClaimed: z.number().int().nullable().optional(),
  noticeDeadline: z.string().nullable().optional(),
  resolve: z.object({ status: z.enum(["awarded", "rejected"]), daysAwarded: z.number().int().nullable().optional() }).optional(),
  status: z.enum(["closed"]).optional()
});

export async function PATCH(request: Request, context: { params: { projectId: string; delayEventId: string } }) {
  const userId = await requireUserId(request);
  const { projectId, delayEventId } = context.params;
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

  const existing = await prisma.delayEvent.findFirst({ where: { id: delayEventId, projectId } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const payload = patchSchema.parse(await request.json());

  if (payload.resolve) {
    await resolveDelayEvent({ delayEventId, status: payload.resolve.status, daysAwarded: payload.resolve.daysAwarded });
  }

  const delayEvent = await prisma.delayEvent.update({
    where: { id: delayEventId },
    data: {
      cause: payload.cause,
      clauseReference: payload.clauseReference,
      startDate: payload.startDate ? new Date(payload.startDate) : undefined,
      endDate: payload.endDate === undefined ? undefined : payload.endDate ? new Date(payload.endDate) : null,
      daysClaimed: payload.daysClaimed,
      noticeDeadline: payload.noticeDeadline === undefined ? undefined : payload.noticeDeadline ? new Date(payload.noticeDeadline) : null,
      status: payload.status
    }
  });

  return NextResponse.json({ delayEvent });
}

export async function DELETE(request: Request, context: { params: { projectId: string; delayEventId: string } }) {
  const userId = await requireUserId(request);
  const { projectId, delayEventId } = context.params;
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

  const existing = await prisma.delayEvent.findFirst({ where: { id: delayEventId, projectId } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.delayEvent.delete({ where: { id: delayEventId } });
  return NextResponse.json({ ok: true });
}
