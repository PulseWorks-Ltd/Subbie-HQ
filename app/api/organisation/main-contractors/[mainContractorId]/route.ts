import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { getOrganisationMembership, requireOrganisationAdmin } from "@/lib/organisation";
import { hasModuleAccess } from "@/lib/permissions";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  // Payment Claim PDF TO-block.
  address: z.string().min(1).nullable().optional()
});

export async function GET(request: Request, context: { params: { mainContractorId: string } }) {
  const userId = await requireUserId(request);
  const { mainContractorId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const membership = await getOrganisationMembership(userId);
  if (!hasModuleAccess(membership, "main_contractors")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const mainContractor = await prisma.mainContractor.findFirst({
    where: { id: mainContractorId, organisationId: membership!.organisationId },
    include: {
      contacts: { orderBy: { createdAt: "asc" } },
      projects: { select: { id: true, name: true, status: true, jobNumber: true }, orderBy: { createdAt: "desc" } }
    }
  });
  if (!mainContractor) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ mainContractor });
}

export async function PATCH(request: Request, context: { params: { mainContractorId: string } }) {
  const userId = await requireUserId(request);
  const { mainContractorId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = await requireOrganisationAdmin(userId);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.mainContractor.findFirst({
    where: { id: mainContractorId, organisationId: admin.organisationId }
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const payload = updateSchema.parse(await request.json());
  const mainContractor = await prisma.mainContractor.update({
    where: { id: mainContractorId },
    data: { name: payload.name, address: payload.address }
  });

  return NextResponse.json({ mainContractor });
}

export async function DELETE(request: Request, context: { params: { mainContractorId: string } }) {
  const userId = await requireUserId(request);
  const { mainContractorId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = await requireOrganisationAdmin(userId);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.mainContractor.findFirst({
    where: { id: mainContractorId, organisationId: admin.organisationId },
    include: { projects: { select: { id: true } } }
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.projects.length > 0) {
    return NextResponse.json(
      { error: "Can't delete a Main Contractor that's still assigned to projects. Reassign those projects first." },
      { status: 400 }
    );
  }

  await prisma.$transaction([
    prisma.projectContact.deleteMany({ where: { contact: { mainContractorId } } }),
    prisma.mainContractorContact.deleteMany({ where: { mainContractorId } }),
    prisma.mainContractor.delete({ where: { id: mainContractorId } })
  ]);

  return NextResponse.json({ ok: true });
}
