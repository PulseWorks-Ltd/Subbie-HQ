import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { deleteFromS3 } from "@/lib/s3";
import { SAFETY_DOCUMENT_TYPES } from "@/lib/safety-document-types";

const updateSafetyDocumentSchema = z.object({
  title: z.string().min(1).optional(),
  type: z.enum(SAFETY_DOCUMENT_TYPES as [string, ...string[]]).optional(),
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

  const canAccessModule = await requireModuleAccess(projectId, userId, "health_safety");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = updateSafetyDocumentSchema.parse(await request.json());

  const safetyDocument = await prisma.safetyDocument.update({
    where: { id: safetyDocumentId, projectId },
    data: {
      title: payload.title,
      type: payload.type as (typeof SAFETY_DOCUMENT_TYPES)[number] | undefined,
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

  const canAccessModule = await requireModuleAccess(projectId, userId, "health_safety");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const safetyDocument = await prisma.safetyDocument.findFirst({ where: { id: safetyDocumentId, projectId } });
  if (safetyDocument?.storageKey) {
    await deleteFromS3(safetyDocument.storageKey);
  }

  await prisma.safetyDocument.delete({ where: { id: safetyDocumentId, projectId } });

  return NextResponse.json({ ok: true });
}
