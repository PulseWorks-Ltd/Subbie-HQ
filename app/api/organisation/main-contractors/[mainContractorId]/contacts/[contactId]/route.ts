import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { requireOrganisationAdmin } from "@/lib/organisation";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  role: z.string().optional()
});

async function requireContact(mainContractorId: string, contactId: string, organisationId: string) {
  return prisma.mainContractorContact.findFirst({
    where: { id: contactId, mainContractorId, mainContractor: { organisationId } }
  });
}

export async function PATCH(
  request: Request,
  context: { params: { mainContractorId: string; contactId: string } }
) {
  const userId = await requireUserId(request);
  const { mainContractorId, contactId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = await requireOrganisationAdmin(userId);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await requireContact(mainContractorId, contactId, admin.organisationId);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const payload = updateSchema.parse(await request.json());
  const contact = await prisma.mainContractorContact.update({
    where: { id: contactId },
    data: {
      name: payload.name,
      email: payload.email !== undefined ? payload.email || null : undefined,
      phone: payload.phone !== undefined ? payload.phone || null : undefined,
      role: payload.role !== undefined ? payload.role || null : undefined
    }
  });

  return NextResponse.json({ contact });
}

export async function DELETE(
  request: Request,
  context: { params: { mainContractorId: string; contactId: string } }
) {
  const userId = await requireUserId(request);
  const { mainContractorId, contactId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = await requireOrganisationAdmin(userId);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await requireContact(mainContractorId, contactId, admin.organisationId);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.projectContact.deleteMany({ where: { mainContractorContactId: contactId } }),
    prisma.mainContractorContact.delete({ where: { id: contactId } })
  ]);

  return NextResponse.json({ ok: true });
}
