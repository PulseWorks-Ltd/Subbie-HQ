import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, requireUserId } from "@/lib/auth";
import { cancelVariationScheduleRun } from "@/lib/variation-schedule";

const patchSchema = z.object({ cancel: z.literal(true) });

// Cancellation is deliberately NOT admin-gated, unlike turning automation
// on or editing the recipient list — cancelling an upcoming automatic send
// is the safe, conservative action (it can only stop something from going
// out, never cause one to), so any project member should be able to hit
// it without needing an admin around. This is Task 3's "clear, simple,
// unambiguous cancellation mechanism": one button, one API call, one
// status flip — see lib/variation-schedule.ts's cancelVariationScheduleRun.
export async function PATCH(request: Request, context: { params: { projectId: string; runId: string } }) {
  const userId = await requireUserId(request);
  const { projectId, runId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  patchSchema.parse(await request.json());

  const run = await prisma.variationScheduleRun.findFirst({ where: { id: runId, projectId } });
  if (!run) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const result = await cancelVariationScheduleRun(runId, userId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
