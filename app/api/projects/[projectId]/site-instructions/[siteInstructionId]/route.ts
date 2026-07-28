import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";

const updateSiteInstructionSchema = z.object({
  status: z.enum(["open", "complete"]).optional(),
  dueAt: z.string().datetime().optional()
});

export async function PATCH(
  request: Request,
  context: { params: { projectId: string; siteInstructionId: string } }
) {
  const userId = await requireUserId(request);
  const { projectId, siteInstructionId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const canAccessModule = await requireModuleAccess(projectId, userId, "site_instructions");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = updateSiteInstructionSchema.parse(await request.json());

  const siteInstruction = await prisma.siteInstruction.update({
    where: { id: siteInstructionId, projectId },
    data: {
      status: payload.status,
      dueAt: payload.dueAt ? new Date(payload.dueAt) : undefined
    }
  });

  return NextResponse.json({ siteInstruction });
}
