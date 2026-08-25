import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, requireUserId } from "@/lib/auth";
import { getOrganisationMembership } from "@/lib/organisation";

async function requireAdmin(projectId: string, userId: string): Promise<boolean> {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { organisationId: true } });
  if (!project?.organisationId) return true;
  const membership = await getOrganisationMembership(userId);
  return Boolean(membership?.isAdmin && membership.organisationId === project.organisationId);
}

export async function DELETE(request: Request, context: { params: { projectId: string; recipientId: string } }) {
  const userId = await requireUserId(request);
  const { projectId, recipientId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await requireAdmin(projectId, userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const recipient = await prisma.variationScheduleRecipient.findFirst({ where: { id: recipientId, projectId } });
  if (!recipient) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.variationScheduleRecipient.delete({ where: { id: recipientId } });
  return NextResponse.json({ ok: true });
}
