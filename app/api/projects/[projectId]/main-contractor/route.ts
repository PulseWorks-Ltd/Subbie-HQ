import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, requireUserId } from "@/lib/auth";
import { getOrganisationMembership } from "@/lib/organisation";

const updateSchema = z.object({
  mainContractorId: z.string().min(1),
  jobNumber: z.string().optional(),
  activeContactIds: z.array(z.string()).default([])
});

// Reassigning a project's Main Contractor and its active contacts is
// structural project config (same admin-only gate as risk level / invoice
// mode in the sibling settings route) — not something any project member
// should be able to change.
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

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      organisationId: true,
      jobNumber: true,
      mainContractorId: true,
      mainContractor: { include: { contacts: { orderBy: { createdAt: "asc" } } } },
      projectContacts: { where: { active: true }, select: { mainContractorContactId: true } }
    }
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const mainContractors = project.organisationId
    ? await prisma.mainContractor.findMany({
        where: { organisationId: project.organisationId },
        include: { contacts: { orderBy: { createdAt: "asc" } } },
        orderBy: { name: "asc" }
      })
    : [];

  return NextResponse.json({
    jobNumber: project.jobNumber,
    mainContractorId: project.mainContractorId,
    mainContractor: project.mainContractor,
    activeContactIds: project.projectContacts.map((pc) => pc.mainContractorContactId),
    mainContractors
  });
}

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

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { organisationId: true } });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (project.organisationId) {
    const membership = await getOrganisationMembership(userId);
    if (!membership?.isAdmin || membership.organisationId !== project.organisationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const payload = updateSchema.parse(await request.json());

  const mainContractor = await prisma.mainContractor.findFirst({
    where: { id: payload.mainContractorId, organisationId: project.organisationId ?? undefined }
  });
  if (!mainContractor) {
    return NextResponse.json({ error: "Main Contractor not found" }, { status: 400 });
  }

  // Validate the selected contacts actually belong to this Main Contractor.
  const validContacts = await prisma.mainContractorContact.findMany({
    where: { id: { in: payload.activeContactIds }, mainContractorId: payload.mainContractorId },
    select: { id: true }
  });
  const validContactIds = new Set(validContacts.map((c) => c.id));

  await prisma.$transaction([
    prisma.project.update({
      where: { id: projectId },
      data: { mainContractorId: payload.mainContractorId, jobNumber: payload.jobNumber || undefined }
    }),
    // Deactivate everything first, then reactivate exactly the selected set —
    // keeps historical ProjectContact rows around (per spec) instead of
    // deleting them, so a contact toggled off and back on doesn't lose its
    // original createdAt.
    prisma.projectContact.updateMany({ where: { projectId }, data: { active: false } }),
    ...Array.from(validContactIds).map((contactId) =>
      prisma.projectContact.upsert({
        where: { projectId_mainContractorContactId: { projectId, mainContractorContactId: contactId } },
        create: { projectId, mainContractorContactId: contactId, active: true },
        update: { active: true }
      })
    )
  ]);

  return NextResponse.json({ ok: true });
}
