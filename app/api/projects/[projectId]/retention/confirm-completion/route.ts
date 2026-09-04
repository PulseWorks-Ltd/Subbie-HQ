import { NextResponse } from "next/server";
import { z } from "zod";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { confirmCompletionOfWorks, getRetentionSummary } from "@/lib/retention";

// The explicit "Confirm completion" action (Retention V2 plan §6.1/§8) —
// a genuine, logged event, distinct from just reading Project.completedAt
// passively. See lib/retention.ts's confirmCompletionOfWorks for the
// RecordLifecycleEvent audit trail this writes alongside the date itself.
const confirmSchema = z.object({
  confirmedAt: z.string(),
  note: z.string().nullable().optional()
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
  const canAccessModule = await requireModuleAccess(projectId, userId, "payment_claims");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = confirmSchema.parse(await request.json());
  const confirmedAt = new Date(payload.confirmedAt);
  if (Number.isNaN(confirmedAt.getTime())) {
    return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  }

  await confirmCompletionOfWorks({ projectId, confirmedAt, note: payload.note, userId });

  const summary = await getRetentionSummary(projectId);
  return NextResponse.json({ summary });
}
