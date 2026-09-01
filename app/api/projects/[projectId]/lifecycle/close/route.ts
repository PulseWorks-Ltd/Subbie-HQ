import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrganisationMembership } from "@/lib/organisation";
import { closeProject, reviewProjectForClosure } from "@/lib/project-lifecycle";

const closeSchema = z.object({ force: z.boolean().optional(), note: z.string().optional() });

async function requireAdmin(projectId: string, userId: string): Promise<boolean> {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { organisationId: true } });
  if (!project?.organisationId) return true; // legacy, org-less project — same fallback as Settings itself
  const membership = await getOrganisationMembership(userId);
  return Boolean(membership?.isAdmin && membership.organisationId === project.organisationId);
}

// Same admin-only gate as the Settings page itself — closing a project is
// a structural, project-wide decision, not a per-member action.
export async function GET(request: Request, context: { params: { projectId: string } }) {
  const userId = await requireUserId(request);
  const { projectId } = context.params;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireAdmin(projectId, userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const review = await reviewProjectForClosure(projectId);
  return NextResponse.json({ review });
}

export async function POST(request: Request, context: { params: { projectId: string } }) {
  const userId = await requireUserId(request);
  const { projectId } = context.params;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireAdmin(projectId, userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = closeSchema.parse(await request.json().catch(() => ({})));
  const result = await closeProject({ projectId, userId, force: payload.force, note: payload.note });

  if (!result.ok) {
    return NextResponse.json({ ok: false, review: result.warnings }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
