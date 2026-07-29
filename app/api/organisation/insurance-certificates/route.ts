import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { getOrganisationMembership, requireOrganisationAdmin } from "@/lib/organisation";
import { hasModuleAccess } from "@/lib/permissions";
import { uploadToS3 } from "@/lib/s3";

const certificateTypeSchema = z.enum([
  "public_liability",
  "contract_works",
  "professional_indemnity",
  "vehicle",
  "other"
]);

export async function GET(request: Request) {
  const userId = await requireUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const membership = await getOrganisationMembership(userId);
  if (!hasModuleAccess(membership, "insurance")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const insuranceCertificates = await prisma.insuranceCertificate.findMany({
    where: { organisationId: membership!.organisationId },
    include: {
      distributions: { include: { project: { select: { id: true, name: true } } } },
      covers: { orderBy: { createdAt: "asc" } }
    },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ insuranceCertificates });
}

export async function POST(request: Request) {
  const userId = await requireUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = await requireOrganisationAdmin(userId);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const type = certificateTypeSchema.parse(formData.get("type")?.toString());
  const provider = formData.get("provider")?.toString();
  const policyNumber = formData.get("policyNumber")?.toString();
  const expiryAt = formData.get("expiryAt")?.toString();
  const file = formData.get("file");
  // From the /parse preview step — already uploaded, no need to re-upload.
  const existingFileName = formData.get("fileName")?.toString();
  const existingStorageKey = formData.get("storageKey")?.toString();
  const coversRaw = formData.get("covers")?.toString();

  if (!provider) {
    return NextResponse.json({ error: "Provider is required" }, { status: 400 });
  }

  let fileName: string | undefined = existingFileName || undefined;
  let storageKey: string | undefined = existingStorageKey || undefined;

  if (file instanceof File && file.size > 0) {
    const buffer = new Uint8Array(await file.arrayBuffer());
    const uploadKey = `organisations/${admin.organisationId}/insurance-certificates/${Date.now()}-${file.name}`;
    const uploaded = await uploadToS3({ key: uploadKey, body: buffer, contentType: file.type || "application/octet-stream" });
    fileName = file.name;
    storageKey = uploaded.storageKey;
  }

  const covers: { coverType: string; value: number }[] = coversRaw ? JSON.parse(coversRaw) : [];

  const insuranceCertificate = await prisma.insuranceCertificate.create({
    data: {
      organisationId: admin.organisationId,
      type,
      provider,
      policyNumber: policyNumber || undefined,
      expiryAt: expiryAt ? new Date(expiryAt) : undefined,
      fileName,
      storageKey,
      covers: {
        create: covers
          .filter((c) => c.coverType.trim() && Number.isFinite(c.value))
          .map((c) => ({ coverType: c.coverType.trim(), value: c.value }))
      }
    },
    include: { covers: true }
  });

  return NextResponse.json({ insuranceCertificate }, { status: 201 });
}
