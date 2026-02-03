import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, requireUserId } from "@/lib/auth";

const createSchema = z.object({
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  completedValue: z.number().nonnegative(),
  notes: z.string().optional(),
  status: z.enum(["draft", "parsed", "confirmed"]).optional()
});

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

  const records = await prisma.monthlyWorkRecord.findMany({
    where: { projectId },
    orderBy: { periodStart: "desc" }
  });

  return NextResponse.json({ records });
}

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

  const payload = createSchema.parse(await request.json());

  const record = await prisma.monthlyWorkRecord.create({
    data: {
      projectId,
      periodStart: new Date(payload.periodStart),
      periodEnd: new Date(payload.periodEnd),
      completedValue: payload.completedValue,
      notes: payload.notes,
      status: payload.status
    }
  });

  return NextResponse.json({ record }, { status: 201 });
}
