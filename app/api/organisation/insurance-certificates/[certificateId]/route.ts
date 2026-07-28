import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { requireOrganisationAdmin } from "@/lib/organisation";
import { deleteFromS3 } from "@/lib/s3";

const updateCertificateSchema = z.object({
  provider: z.string().min(1).optional(),
  policyNumber: z.string().nullable().optional(),
  expiryAt: z.string().datetime().nullable().optional()
});

export async function PATCH(request: Request, context: { params: { certificateId: string } }) {
  const userId = await requireUserId(request);
  const { certificateId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = await requireOrganisationAdmin(userId);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = updateCertificateSchema.parse(await request.json());

  const existing = await prisma.insuranceCertificate.findFirst({
    where: { id: certificateId, organisationId: admin.organisationId }
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Editing the expiry date resets the reminder stage — a renewed policy
  // with a new expiry date should be able to trigger a fresh 6-week reminder.
  const expiryChanged = payload.expiryAt !== undefined && payload.expiryAt !== existing.expiryAt?.toISOString();

  const insuranceCertificate = await prisma.insuranceCertificate.update({
    where: { id: certificateId },
    data: {
      provider: payload.provider,
      policyNumber: payload.policyNumber ?? undefined,
      expiryAt: payload.expiryAt === undefined ? undefined : payload.expiryAt ? new Date(payload.expiryAt) : null,
      lastReminderStage: expiryChanged ? null : undefined
    }
  });

  return NextResponse.json({ insuranceCertificate });
}

export async function DELETE(request: Request, context: { params: { certificateId: string } }) {
  const userId = await requireUserId(request);
  const { certificateId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = await requireOrganisationAdmin(userId);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.insuranceCertificate.findFirst({
    where: { id: certificateId, organisationId: admin.organisationId }
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Correspondence rows referencing this certificate keep their own record
  // (title text stands alone) but can no longer link to it once it's gone.
  await prisma.correspondence.updateMany({
    where: { sourceInsuranceCertificateId: certificateId },
    data: { sourceInsuranceCertificateId: null }
  });
  await prisma.insuranceDistribution.deleteMany({ where: { insuranceCertificateId: certificateId } });

  if (existing.storageKey) {
    await deleteFromS3(existing.storageKey);
  }

  await prisma.insuranceCertificate.delete({ where: { id: certificateId } });

  return NextResponse.json({ ok: true });
}
