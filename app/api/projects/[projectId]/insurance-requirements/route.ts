import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { uploadToS3 } from "@/lib/s3";

const insuranceTypeSchema = z.enum([
  "contract_works",
  "plant_and_equipment",
  "public_liability",
  "motor_vehicle_liability",
  "professional_indemnity",
  "other"
]);

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

  const canAccessModule = await requireModuleAccess(projectId, userId, "insurance");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const insuranceRequirements = await prisma.insuranceRequirement.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ insuranceRequirements });
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

  const canAccessModule = await requireModuleAccess(projectId, userId, "insurance");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const type = insuranceTypeSchema.parse(formData.get("type")?.toString());
  const label = formData.get("label")?.toString();
  const requiredRaw = formData.get("required")?.toString();
  const minimumAmountRaw = formData.get("minimumAmount")?.toString();
  const certificateExpiresAt = formData.get("certificateExpiresAt")?.toString();
  const file = formData.get("file");

  if (!label) {
    return NextResponse.json({ error: "Label is required" }, { status: 400 });
  }

  let certificateFileName: string | undefined;
  let certificateStorageKey: string | undefined;

  if (file instanceof File && file.size > 0) {
    const buffer = new Uint8Array(await file.arrayBuffer());
    const uploadKey = `projects/${projectId}/insurance-requirements/${Date.now()}-${file.name}`;
    const uploaded = await uploadToS3({ key: uploadKey, body: buffer, contentType: file.type || "application/octet-stream" });
    certificateFileName = file.name;
    certificateStorageKey = uploaded.storageKey;
  }

  const insuranceRequirement = await prisma.insuranceRequirement.create({
    data: {
      projectId,
      type,
      label,
      required: requiredRaw === undefined ? true : requiredRaw === "true",
      minimumAmount: minimumAmountRaw ? Number(minimumAmountRaw) : undefined,
      status: "confirmed",
      certificateFileName,
      certificateStorageKey,
      certificateExpiresAt: certificateExpiresAt ? new Date(certificateExpiresAt) : undefined
    }
  });

  return NextResponse.json({ insuranceRequirement }, { status: 201 });
}
