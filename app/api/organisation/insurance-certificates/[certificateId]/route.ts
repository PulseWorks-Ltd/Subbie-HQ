import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { requireOrganisationAdmin } from "@/lib/organisation";
import { deleteFromS3, uploadToS3 } from "@/lib/s3";

// FormData (not JSON) so a renewed certificate's replacement file can be
// uploaded in the same request as its other field edits — mirrors the
// create route's shape, including the same fileName/storageKey pass-through
// for a file already uploaded via /parse.
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

  const existing = await prisma.insuranceCertificate.findFirst({
    where: { id: certificateId, organisationId: admin.organisationId }
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const provider = formData.get("provider")?.toString();
  const policyNumberRaw = formData.get("policyNumber");
  const expiryAtRaw = formData.get("expiryAt");
  const file = formData.get("file");
  const existingFileName = formData.get("fileName")?.toString();
  const existingStorageKey = formData.get("storageKey")?.toString();
  const coversRaw = formData.get("covers")?.toString();

  const policyNumber = policyNumberRaw === null ? undefined : policyNumberRaw.toString() || null;
  const expiryAt = expiryAtRaw === null ? undefined : expiryAtRaw.toString() || null;

  // Editing the expiry date resets the reminder stage — a renewed policy
  // with a new expiry date should be able to trigger a fresh 6-week reminder.
  const expiryChanged = expiryAt !== undefined && expiryAt !== existing.expiryAt?.toISOString();

  let fileName: string | undefined = existingFileName || undefined;
  let storageKey: string | undefined = existingStorageKey || undefined;
  const replacingFile = (file instanceof File && file.size > 0) || Boolean(existingStorageKey);

  if (file instanceof File && file.size > 0) {
    const buffer = new Uint8Array(await file.arrayBuffer());
    const uploadKey = `organisations/${admin.organisationId}/insurance-certificates/${Date.now()}-${file.name}`;
    const uploaded = await uploadToS3({ key: uploadKey, body: buffer, contentType: file.type || "application/octet-stream" });
    fileName = file.name;
    storageKey = uploaded.storageKey;
  }
  // A renewed certificate replaces the old file entirely — nothing else
  // references the old storageKey directly (Correspondence references the
  // certificate row, not its file), so it's safe to delete once replaced.
  if (replacingFile && existing.storageKey && existing.storageKey !== storageKey) {
    await deleteFromS3(existing.storageKey).catch(() => {});
  }

  const covers: { coverType: string; value: number }[] | undefined = coversRaw ? JSON.parse(coversRaw) : undefined;

  const insuranceCertificate = await prisma.$transaction(async (tx) => {
    if (covers) {
      await tx.insuranceCertificateCover.deleteMany({ where: { insuranceCertificateId: certificateId } });
    }
    return tx.insuranceCertificate.update({
      where: { id: certificateId },
      data: {
        provider,
        policyNumber,
        expiryAt: expiryAt === undefined ? undefined : expiryAt ? new Date(expiryAt) : null,
        lastReminderStage: expiryChanged ? null : undefined,
        fileName: replacingFile ? fileName : undefined,
        storageKey: replacingFile ? storageKey : undefined,
        covers: covers
          ? { create: covers.filter((c) => c.coverType.trim() && Number.isFinite(c.value)).map((c) => ({ coverType: c.coverType.trim(), value: c.value })) }
          : undefined
      },
      include: { covers: true }
    });
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
