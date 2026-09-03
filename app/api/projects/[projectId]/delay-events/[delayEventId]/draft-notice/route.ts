import { NextResponse } from "next/server";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { draftDelayNoticeMessage } from "@/lib/grok";
import { AiSpendCapExceededError } from "@/lib/ai-usage";

function formatDate(date: Date) {
  return date.toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

export async function POST(request: Request, context: { params: { projectId: string; delayEventId: string } }) {
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

  const delayEvent = await prisma.delayEvent.findFirst({ where: { id: delayEventId, projectId } });
  if (!delayEvent) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { organisationId: true } });

  try {
    const drafted = await draftDelayNoticeMessage(
      {
        cause: delayEvent.cause,
        startDate: formatDate(delayEvent.startDate),
        endDate: delayEvent.endDate ? formatDate(delayEvent.endDate) : null,
        clauseReference: delayEvent.clauseReference,
        daysClaimed: delayEvent.daysClaimed
      },
      { organisationId: project?.organisationId ?? null, userId, contextRef: delayEventId }
    );
    return NextResponse.json({ drafted });
  } catch (error) {
    if (error instanceof AiSpendCapExceededError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    return NextResponse.json({ error: "Could not draft this notice automatically. You can still write it yourself." }, { status: 422 });
  }
}
