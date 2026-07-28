import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { deleteFromS3 } from "@/lib/s3";

const updateInsuranceRequirementSchema = z.object({
  label: z.string().min(1).optional(),
  required: z.boolean().optional(),
  minimumAmount: z.number().nullable().optional(),
  certificateExpiresAt: z.string().datetime().nullable().optional(),
  confirmSuggested: z.boolean().optional()
});

export async function PATCH(
  request: Request,
  context: { params: { projectId: string; requirementId: string } }
) {
  const userId = await requireUserId(request);
  const { projectId, requirementId } = context.params;
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

  const payload = updateInsuranceRequirementSchema.parse(await request.json());

  const insuranceRequirement = await prisma.insuranceRequirement.update({
    where: { id: requirementId, projectId },
    data: {
      label: payload.label,
      required: payload.required,
      minimumAmount: payload.minimumAmount === undefined ? undefined : payload.minimumAmount,
      certificateExpiresAt:
        payload.certificateExpiresAt === undefined
          ? undefined
          : payload.certificateExpiresAt
            ? new Date(payload.certificateExpiresAt)
            : null,
      status: payload.confirmSuggested ? "confirmed" : undefined
    }
  });

  return NextResponse.json({ insuranceRequirement });
}

export async function DELETE(
  request: Request,
  context: { params: { projectId: string; requirementId: string } }
) {
  const userId = await requireUserId(request);
  const { projectId, requirementId } = context.params;
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

  const insuranceRequirement = await prisma.insuranceRequirement.findFirst({ where: { id: requirementId, projectId } });
  if (insuranceRequirement?.certificateStorageKey) {
    await deleteFromS3(insuranceRequirement.certificateStorageKey);
  }

  await prisma.insuranceRequirement.delete({ where: { id: requirementId, projectId } });

  return NextResponse.json({ ok: true });
}
