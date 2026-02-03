import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, requireUserId } from "@/lib/auth";

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  amount: z.number().nonnegative(),
  status: z.enum(["draft", "submitted", "approved", "rejected"]).optional(),
  sourceRef: z.string().optional()
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

  const variations = await prisma.variation.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ variations });
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

  const variation = await prisma.variation.create({
    data: {
      projectId,
      title: payload.title,
      description: payload.description,
      amount: payload.amount,
      status: payload.status,
      sourceRef: payload.sourceRef
    }
  });

  return NextResponse.json({ variation }, { status: 201 });
}
