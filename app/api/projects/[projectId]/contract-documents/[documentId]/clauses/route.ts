import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, requireUserId } from "@/lib/auth";

const createClauseSchema = z.object({
  clauseRef: z.string().min(1),
  title: z.string().optional(),
  body: z.string().min(1),
  riskLevel: z.enum(["low", "medium", "high"]).optional(),
  status: z.enum(["draft", "parsed", "confirmed"]).optional(),
  pageNumber: z.number().int().optional(),
  sourceRef: z.string().optional()
});

export async function GET(
  request: Request,
  context: { params: { projectId: string; documentId: string } }
) {
  const userId = await requireUserId(request);
  const { projectId, documentId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const clauses = await prisma.clause.findMany({
    where: { projectId, documentId },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ clauses });
}

export async function POST(
  request: Request,
  context: { params: { projectId: string; documentId: string } }
) {
  const userId = await requireUserId(request);
  const { projectId, documentId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = createClauseSchema.parse(await request.json());

  const clause = await prisma.clause.create({
    data: {
      projectId,
      documentId,
      clauseRef: payload.clauseRef,
      title: payload.title,
      body: payload.body,
      riskLevel: payload.riskLevel,
      status: payload.status,
      pageNumber: payload.pageNumber,
      sourceRef: payload.sourceRef
    }
  });

  return NextResponse.json({ clause }, { status: 201 });
}
