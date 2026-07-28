import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { requireOrganisationAdmin } from "@/lib/organisation";
import { MODULES } from "@/lib/permissions";

const updateMemberSchema = z.object({
  title: z.string().optional().nullable(),
  isAdmin: z.boolean().optional(),
  modules: z.record(z.enum(MODULES), z.boolean()).optional()
});

async function wouldRemoveLastAdmin(organisationId: string, memberId: string) {
  const otherAdminCount = await prisma.organisationMember.count({
    where: { organisationId, isAdmin: true, id: { not: memberId } }
  });
  return otherAdminCount === 0;
}

export async function PATCH(request: Request, context: { params: { memberId: string } }) {
  const userId = await requireUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = await requireOrganisationAdmin(userId);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = updateMemberSchema.parse(await request.json());
  const { memberId } = context.params;

  if (payload.isAdmin === false) {
    const member = await prisma.organisationMember.findFirst({ where: { id: memberId, organisationId: admin.organisationId } });
    if (member?.isAdmin && (await wouldRemoveLastAdmin(admin.organisationId, memberId))) {
      return NextResponse.json({ error: "Your organisation needs at least one Admin." }, { status: 400 });
    }
  }

  const member = await prisma.organisationMember.update({
    where: { id: memberId, organisationId: admin.organisationId },
    data: {
      title: payload.title === undefined ? undefined : payload.title || null,
      isAdmin: payload.isAdmin,
      modules: payload.modules
    }
  });

  return NextResponse.json({ member });
}

export async function DELETE(request: Request, context: { params: { memberId: string } }) {
  const userId = await requireUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = await requireOrganisationAdmin(userId);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { memberId } = context.params;
  const member = await prisma.organisationMember.findFirst({ where: { id: memberId, organisationId: admin.organisationId } });
  if (member?.isAdmin && (await wouldRemoveLastAdmin(admin.organisationId, memberId))) {
    return NextResponse.json({ error: "Your organisation needs at least one Admin." }, { status: 400 });
  }

  await prisma.organisationMember.delete({ where: { id: memberId, organisationId: admin.organisationId } });

  return NextResponse.json({ ok: true });
}
