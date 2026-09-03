import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { getContractScheduleForProject } from "@/lib/contract-schedule";

const updateScheduleSchema = z.object({
  status: z.enum(["draft", "parsed", "confirmed"]).optional(),
  defaultErectPercent: z.number().min(0).max(100).nullable().optional(),
  defaultDismantlePercent: z.number().min(0).max(100).nullable().optional()
});

// GET creates the schedule row on first access rather than requiring a
// separate "set up your schedule" step — there's nothing to configure
// before a project has one (it's just a container for items), so there's
// no reason to make the user create it explicitly.
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
  const canAccessModule = await requireModuleAccess(projectId, userId, "payment_claims");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.contractSchedule.upsert({
    where: { projectId },
    update: {},
    create: { projectId }
  });

  const schedule = await getContractScheduleForProject(projectId);
  return NextResponse.json({ schedule });
}

export async function PATCH(request: Request, context: { params: { projectId: string } }) {
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

  const payload = updateScheduleSchema.parse(await request.json());

  const schedule = await prisma.contractSchedule.upsert({
    where: { projectId },
    update: {
      status: payload.status,
      defaultErectPercent: payload.defaultErectPercent,
      defaultDismantlePercent: payload.defaultDismantlePercent
    },
    create: {
      projectId,
      status: payload.status,
      defaultErectPercent: payload.defaultErectPercent,
      defaultDismantlePercent: payload.defaultDismantlePercent
    }
  });

  return NextResponse.json({ schedule });
}
