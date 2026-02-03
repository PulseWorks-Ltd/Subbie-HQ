import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, requireUserId } from "@/lib/auth";

const updateProgrammeSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  status: z.enum(["draft", "parsed", "confirmed"]).optional(),
  confidence: z.number().min(0).max(1).optional(),
  scopeItemIds: z.array(z.string()).optional()
});

export async function PATCH(
  request: Request,
  context: { params: { projectId: string; programmeId: string } }
) {
  const userId = await requireUserId(request);
  const { projectId, programmeId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = updateProgrammeSchema.parse(await request.json());

  const programmeItem = await prisma.programmeItem.update({
    where: { id: programmeId, projectId },
    data: {
      title: payload.title,
      description: payload.description ?? undefined,
      startDate: payload.startDate ? new Date(payload.startDate) : undefined,
      endDate: payload.endDate ? new Date(payload.endDate) : undefined,
      status: payload.status,
      confidence: payload.confidence
    }
  });

  if (payload.scopeItemIds) {
    await prisma.scopeProgrammeLink.deleteMany({
      where: { programmeItemId: programmeId }
    });

    if (payload.scopeItemIds.length) {
      await prisma.scopeProgrammeLink.createMany({
        data: payload.scopeItemIds.map((scopeItemId) => ({
          scopeItemId,
          programmeItemId: programmeId
        })),
        skipDuplicates: true
      });
    }
  }

  return NextResponse.json({ item: programmeItem });
}

export async function DELETE(
  request: Request,
  context: { params: { projectId: string; programmeId: string } }
) {
  const userId = await requireUserId(request);
  const { projectId, programmeId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.scopeProgrammeLink.deleteMany({ where: { programmeItemId: programmeId } });
  await prisma.evidenceProgrammeItem.deleteMany({ where: { programmeItemId: programmeId } });
  await prisma.programmeItem.delete({ where: { id: programmeId, projectId } });

  return NextResponse.json({ ok: true });
}
