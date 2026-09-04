import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { buildContractItemCreateData } from "@/lib/contract-schedule";
import { itemInputSchema, validateComponents } from "@/lib/contract-schedule-schemas";

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

  const payload = itemInputSchema.parse(await request.json());
  const validationError = validateComponents(payload.components);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const schedule = await prisma.contractSchedule.upsert({
    where: { projectId },
    update: {},
    create: { projectId }
  });

  const item = await prisma.contractItem.create({
    data: buildContractItemCreateData(schedule.id, payload, 0),
    include: { components: { include: { phases: true } } }
  });

  return NextResponse.json({ item }, { status: 201 });
}
