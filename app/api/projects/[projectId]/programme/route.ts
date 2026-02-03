import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, requireUserId } from "@/lib/auth";

const createProgrammeSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  status: z.enum(["draft", "parsed", "confirmed"]).optional(),
  confidence: z.number().min(0).max(1).optional(),
  sourceDocumentId: z.string().optional(),
  sourcePage: z.number().int().optional(),
  scopeItemIds: z.array(z.string()).optional()
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

  const items = await prisma.programmeItem.findMany({
    where: { projectId },
    include: { scopeLinks: true, evidenceLinks: true },
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

  const payload = createProgrammeSchema.parse(await request.json());

  const programmeItem = await prisma.programmeItem.create({
    data: {
      projectId,
      title: payload.title,
      description: payload.description,
      startDate: payload.startDate ? new Date(payload.startDate) : undefined,
      endDate: payload.endDate ? new Date(payload.endDate) : undefined,
      status: payload.status,
      confidence: payload.confidence,
      sourceDocumentId: payload.sourceDocumentId,
      sourcePage: payload.sourcePage
    }
  });

  if (payload.scopeItemIds?.length) {
    await prisma.scopeProgrammeLink.createMany({
      data: payload.scopeItemIds.map((scopeItemId) => ({
        scopeItemId,
        programmeItemId: programmeItem.id
      })),
      skipDuplicates: true
    });
  }

  return NextResponse.json({ item: programmeItem }, { status: 201 });
}
