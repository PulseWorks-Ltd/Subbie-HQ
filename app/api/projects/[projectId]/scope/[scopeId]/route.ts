import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, requireUserId } from "@/lib/auth";

const updateScopeSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(["draft", "parsed", "confirmed"]).optional(),
  confidence: z.number().min(0).max(1).optional(),
  ambiguityFlag: z.boolean().optional(),
  programmeItemIds: z.array(z.string()).optional()
});

export async function PATCH(
  request: Request,
  context: { params: { projectId: string; scopeId: string } }
) {
  const userId = await requireUserId(request);
  const { projectId, scopeId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = updateScopeSchema.parse(await request.json());

  const scopeItem = await prisma.scopeItem.update({
    where: { id: scopeId, projectId },
    data: {
      title: payload.title,
      description: payload.description ?? undefined,
      status: payload.status,
      confidence: payload.confidence,
      ambiguityFlag: payload.ambiguityFlag
    }
  });

  if (payload.programmeItemIds) {
    await prisma.scopeProgrammeLink.deleteMany({
      where: { scopeItemId: scopeId }
    });

    if (payload.programmeItemIds.length) {
      await prisma.scopeProgrammeLink.createMany({
        data: payload.programmeItemIds.map((programmeItemId) => ({
          scopeItemId: scopeId,
          programmeItemId
        })),
        skipDuplicates: true
      });
    }
  }

  return NextResponse.json({ item: scopeItem });
}

export async function DELETE(
  request: Request,
  context: { params: { projectId: string; scopeId: string } }
) {
  const userId = await requireUserId(request);
  const { projectId, scopeId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.scopeProgrammeLink.deleteMany({ where: { scopeItemId: scopeId } });
  await prisma.evidenceScopeItem.deleteMany({ where: { scopeItemId: scopeId } });
  await prisma.scopeItem.delete({ where: { id: scopeId, projectId } });

  return NextResponse.json({ ok: true });
}
