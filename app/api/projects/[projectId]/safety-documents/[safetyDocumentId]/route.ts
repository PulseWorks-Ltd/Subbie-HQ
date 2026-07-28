import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, requireUserId } from "@/lib/auth";
import { deleteFromS3 } from "@/lib/s3";

const updateSafetyDocumentSchema = z.object({
  title: z.string().min(1).optional(),
  notes: z.string().optional().nullable(),
  expiresAt: z.string().datetime().nullable().optional()
});

export async function PATCH(
  request: Request,
  context: { params: { projectId: string; safetyDocumentId: string } }
) {
  const userId = await requireUserId(request);
  const { projectId, safetyDocumentId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = updateSafetyDocumentSchema.parse(await request.json());

  const safetyDocument = await prisma.safetyDocument.update({
    where: { id: safetyDocumentId, projectId },
    data: {
      title: payload.title,
      notes: payload.notes ?? undefined,
      expiresAt: payload.expiresAt === undefined ? undefined : payload.expiresAt ? new Date(payload.expiresAt) : null
    }
  });

  return NextResponse.json({ safetyDocument });
}

export async function DELETE(
  request: Request,
  context: { params: { projectId: string; safetyDocumentId: string } }
) {
  const userId = await requireUserId(request);
  const { projectId, safetyDocumentId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const safetyDocument = await prisma.safetyDocument.findFirst({ where: { id: safetyDocumentId, projectId } });
  if (safetyDocument?.storageKey) {
    await deleteFromS3(safetyDocument.storageKey);
  }

  await prisma.safetyDocument.delete({ where: { id: safetyDocumentId, projectId } });

  return NextResponse.json({ ok: true });
}
