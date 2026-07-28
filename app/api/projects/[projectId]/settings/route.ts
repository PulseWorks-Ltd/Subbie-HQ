import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { getOrganisationMembership } from "@/lib/organisation";

const updateSchema = z.object({
  invoiceModeEnabled: z.boolean().optional(),
  nextClaimDate: z.string().datetime().optional(),
  riskLevel: z.enum(["low", "medium", "high"]).optional()
});

export async function PATCH(request: Request, context: { params: { projectId: string } }) {
  const userId = await requireUserId(request);
  const { projectId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = updateSchema.parse(await request.json());

  // nextClaimDate is edited from the Payment Claims module (incl. the Dashboard's
  // reschedule action) — everything else here is structural project config, admin-only.
  const changesAdminFields = payload.riskLevel !== undefined || payload.invoiceModeEnabled !== undefined;
  if (changesAdminFields) {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { organisationId: true } });
    if (project?.organisationId) {
      const membership = await getOrganisationMembership(userId);
      if (!membership?.isAdmin || membership.organisationId !== project.organisationId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
  }

  if (payload.nextClaimDate !== undefined) {
    const canAccessModule = await requireModuleAccess(projectId, userId, "payment_claims");
    if (!canAccessModule) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const project = await prisma.project.update({
    where: { id: projectId },
    data: {
      invoiceModeEnabled: payload.invoiceModeEnabled,
      nextClaimDate: payload.nextClaimDate ? new Date(payload.nextClaimDate) : undefined,
      riskLevel: payload.riskLevel
    }
  });

  return NextResponse.json({ project });
}
