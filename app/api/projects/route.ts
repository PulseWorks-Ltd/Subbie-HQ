import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { getOrganisationMembership, getVisibleProjectsWhere } from "@/lib/organisation";

const createProjectSchema = z
  .object({
    name: z.string().min(1),
    code: z.string().optional(),
    jobNumber: z.string().optional(),
    mainContractorId: z.string().optional(),
    newMainContractorName: z.string().optional(),
    activeContactIds: z.array(z.string()).default([])
  })
  .refine((data) => data.mainContractorId || data.newMainContractorName, {
    message: "Select an existing Main Contractor or enter a name for a new one."
  });

export async function GET(request: Request) {
  const userId = await requireUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projects = await prisma.project.findMany({
    where: await getVisibleProjectsWhere(userId),
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  const userId = await requireUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = createProjectSchema.parse(await request.json());

  const membership = await getOrganisationMembership(userId);
  if (membership && !membership.isAdmin) {
    return NextResponse.json({ error: "Only an organisation Admin can create new projects." }, { status: 403 });
  }
  if (!membership) {
    return NextResponse.json({ error: "You must belong to an organisation to create a project." }, { status: 403 });
  }

  let mainContractorId = payload.mainContractorId;
  if (!mainContractorId && payload.newMainContractorName) {
    const created = await prisma.mainContractor.create({
      data: { organisationId: membership.organisationId, name: payload.newMainContractorName }
    });
    mainContractorId = created.id;
  } else if (mainContractorId) {
    const mainContractor = await prisma.mainContractor.findFirst({
      where: { id: mainContractorId, organisationId: membership.organisationId }
    });
    if (!mainContractor) {
      return NextResponse.json({ error: "Main Contractor not found" }, { status: 400 });
    }
  }

  const validContacts = mainContractorId
    ? await prisma.mainContractorContact.findMany({
        where: { id: { in: payload.activeContactIds }, mainContractorId },
        select: { id: true }
      })
    : [];

  const project = await prisma.project.create({
    data: {
      name: payload.name,
      code: payload.code,
      jobNumber: payload.jobNumber || undefined,
      mainContractorId,
      organisationId: membership.organisationId,
      members: {
        create: {
          userId,
          role: "owner"
        }
      },
      projectContacts: {
        create: validContacts.map((c) => ({ mainContractorContactId: c.id, active: true }))
      }
    }
  });

  return NextResponse.json({ project }, { status: 201 });
}
