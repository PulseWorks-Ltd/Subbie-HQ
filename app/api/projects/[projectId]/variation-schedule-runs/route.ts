import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, requireUserId } from "@/lib/auth";

// Recent + upcoming cycles for this project's Settings page — lets anyone
// with project access see (and, via the [runId] route, cancel) the next
// scheduled automatic send without needing to check server logs.
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

  const runs = await prisma.variationScheduleRun.findMany({
    where: { projectId },
    orderBy: { scheduledSendAt: "desc" },
    take: 12
  });

  return NextResponse.json({ runs });
}
