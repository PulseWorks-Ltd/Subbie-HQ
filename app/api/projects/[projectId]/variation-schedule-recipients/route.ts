import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, requireUserId } from "@/lib/auth";
import { getOrganisationMembership } from "@/lib/organisation";

const createSchema = z.object({
  role: z.enum(["to", "cc"]),
  mainContractorContactId: z.string().optional(),
  name: z.string().optional(),
  email: z.string().email().optional()
});

// Admin-only, same as the automation mode setting itself (see
// app/api/projects/[projectId]/settings/route.ts) — this list is who a
// fully_automatic project emails a real commercial document to with no
// human review step, so who's on it is structural project config, not a
// per-member choice.
async function requireAdmin(projectId: string, userId: string): Promise<boolean> {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { organisationId: true } });
  if (!project?.organisationId) return true; // legacy, org-less project — unrestricted, matching this app's existing fallback
  const membership = await getOrganisationMembership(userId);
  return Boolean(membership?.isAdmin && membership.organisationId === project.organisationId);
}

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

  const recipients = await prisma.variationScheduleRecipient.findMany({
    where: { projectId },
    include: { contact: { select: { name: true, email: true } } },
    orderBy: { createdAt: "asc" }
  });

  return NextResponse.json({ recipients });
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
  if (!(await requireAdmin(projectId, userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = createSchema.parse(await request.json());

  if (payload.mainContractorContactId) {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { mainContractorId: true } });
    const contact = await prisma.mainContractorContact.findFirst({
      where: { id: payload.mainContractorContactId, mainContractorId: project?.mainContractorId ?? undefined }
    });
    if (!contact?.email) {
      return NextResponse.json({ error: "This contact has no email on file." }, { status: 400 });
    }
    const recipient = await prisma.variationScheduleRecipient.create({
      data: { projectId, role: payload.role, mainContractorContactId: contact.id, name: contact.name, email: contact.email }
    });
    return NextResponse.json({ recipient }, { status: 201 });
  }

  if (!payload.email || !payload.name) {
    return NextResponse.json({ error: "Enter a name and email address." }, { status: 400 });
  }
  const recipient = await prisma.variationScheduleRecipient.create({
    data: { projectId, role: payload.role, name: payload.name, email: payload.email }
  });
  return NextResponse.json({ recipient }, { status: 201 });
}
