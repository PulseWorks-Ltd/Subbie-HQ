import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { deleteFromS3 } from "@/lib/s3";

const updateQaRecordSchema = z.object({
  stage: z.string().min(1).optional(),
  notes: z.string().optional().nullable(),
  date: z.string().datetime().optional(),
  // "" clears the item link (project-level); undefined leaves it unchanged.
  variationItemId: z.string().nullable().optional()
});

export async function PATCH(request: Request, context: { params: { projectId: string; qaRecordId: string } }) {
  const userId = await requireUserId(request);
  const { projectId, qaRecordId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const canAccessModule = await requireModuleAccess(projectId, userId, "quality_assurance");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = updateQaRecordSchema.parse(await request.json());

  if (payload.variationItemId) {
    const item = await prisma.variationItem.findFirst({ where: { id: payload.variationItemId, projectId } });
    if (!item) {
      return NextResponse.json({ error: "Variation/Site Instruction not found on this project." }, { status: 400 });
    }
  }

  const qaRecord = await prisma.qARecord.update({
    where: { id: qaRecordId, projectId },
    data: {
      stage: payload.stage,
      notes: payload.notes ?? undefined,
      date: payload.date ? new Date(payload.date) : undefined,
      variationItemId: payload.variationItemId === undefined ? undefined : payload.variationItemId || null
    }
  });

  return NextResponse.json({ qaRecord });
}

export async function DELETE(request: Request, context: { params: { projectId: string; qaRecordId: string } }) {
  const userId = await requireUserId(request);
  const { projectId, qaRecordId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const canAccessModule = await requireModuleAccess(projectId, userId, "quality_assurance");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const qaRecord = await prisma.qARecord.findFirst({ where: { id: qaRecordId, projectId }, include: { attachments: true } });
  for (const attachment of qaRecord?.attachments ?? []) {
    await deleteFromS3(attachment.storageKey);
  }

  // Update.qaRecordId is onDelete: SetNull (see migration) — any Update
  // tagged to this record just reverts to "Not Assigned" rather than
  // blocking the delete.
  await prisma.qARecordAttachment.deleteMany({ where: { qaRecordId } });
  await prisma.qARecord.delete({ where: { id: qaRecordId, projectId } });

  return NextResponse.json({ ok: true });
}
