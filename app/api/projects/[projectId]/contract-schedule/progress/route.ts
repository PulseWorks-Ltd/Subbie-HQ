import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";

// Exactly one of phaseId/componentId — a fixed component's phase progress,
// or a weekly_hire component's rental %, never both (see the
// ContractItemProgressEntry schema comment for why this isn't a DB
// constraint). Ownership (does this phase/component genuinely belong to
// THIS project) is checked below rather than trusted from the client.
const createProgressSchema = z
  .object({
    phaseId: z.string().optional(),
    componentId: z.string().optional(),
    effectiveDate: z.string(), // ISO date, e.g. "2026-08-10"
    percent: z.number().min(0).max(100),
    note: z.string().optional()
  })
  .refine((value) => Boolean(value.phaseId) !== Boolean(value.componentId), {
    message: "Provide exactly one of phaseId or componentId."
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

  const payload = createProgressSchema.parse(await request.json());
  const effectiveDate = new Date(payload.effectiveDate);
  if (Number.isNaN(effectiveDate.getTime())) {
    return NextResponse.json({ error: "Invalid effectiveDate." }, { status: 400 });
  }

  if (payload.phaseId) {
    const phase = await prisma.contractItemComponentPhase.findFirst({
      where: { id: payload.phaseId, component: { contractItem: { schedule: { projectId } } } }
    });
    if (!phase) return NextResponse.json({ error: "Not found" }, { status: 404 });
  } else if (payload.componentId) {
    const component = await prisma.contractItemComponent.findFirst({
      where: { id: payload.componentId, contractItem: { schedule: { projectId } }, kind: "weekly_hire" }
    });
    if (!component) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const entry = await prisma.contractItemProgressEntry.create({
    data: {
      phaseId: payload.phaseId,
      componentId: payload.componentId,
      effectiveDate,
      percent: payload.percent,
      note: payload.note || null,
      source: "manual",
      createdByUserId: userId
    }
  });

  return NextResponse.json({ entry }, { status: 201 });
}
