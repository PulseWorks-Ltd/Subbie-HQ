import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, requireUserId } from "@/lib/auth";

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
