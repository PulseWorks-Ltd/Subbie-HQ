import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, requireUserId } from "@/lib/auth";

const createScopeSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(["draft", "parsed", "confirmed"]).optional(),
  confidence: z.number().min(0).max(1).optional(),
  ambiguityFlag: z.boolean().optional(),
  sourceDocumentId: z.string().optional(),
  sourceClauseId: z.string().optional(),
  sourcePage: z.number().int().optional(),
  programmeItemIds: z.array(z.string()).optional()
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

  const items = await prisma.scopeItem.findMany({
    where: { projectId },
    include: { programmeLinks: true, evidenceLinks: true },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ items });
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

  const payload = createScopeSchema.parse(await request.json());

  const scopeItem = await prisma.scopeItem.create({
    data: {
      projectId,
      title: payload.title,
      description: payload.description,
      status: payload.status,
      confidence: payload.confidence,
      ambiguityFlag: payload.ambiguityFlag,
      sourceDocumentId: payload.sourceDocumentId,
      sourceClauseId: payload.sourceClauseId,
      sourcePage: payload.sourcePage
    }
  });

  if (payload.programmeItemIds?.length) {
    await prisma.scopeProgrammeLink.createMany({
      data: payload.programmeItemIds.map((programmeItemId) => ({
        scopeItemId: scopeItem.id,
        programmeItemId
      })),
      skipDuplicates: true
    });
  }

  return NextResponse.json({ item: scopeItem }, { status: 201 });
}
