import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrganisationMembership } from "@/lib/organisation";
import { completeProject } from "@/lib/project-lifecycle";

const completeSchema = z.object({ note: z.string().optional() });

async function requireAdmin(projectId: string, userId: string): Promise<boolean> {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { organisationId: true } });
  if (!project?.organisationId) return true;
  const membership = await getOrganisationMembership(userId);
  return Boolean(membership?.isAdmin && membership.organisationId === project.organisationId);
}

// Marks physical/site work finished — deliberately separate from, and
// never implying, Close (the project can stay "completed" and commercially
// active for a long time afterward while claims/variations finish up).
export async function POST(request: Request, context: { params: { projectId: string } }) {
  const userId = await requireUserId(request);
  const { projectId } = context.params;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireAdmin(projectId, userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = completeSchema.parse(await request.json().catch(() => ({})));
  await completeProject({ projectId, userId, note: payload.note });

  return NextResponse.json({ ok: true });
}
