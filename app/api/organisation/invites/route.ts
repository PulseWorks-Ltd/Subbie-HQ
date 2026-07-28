import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { requireOrganisationAdmin } from "@/lib/organisation";
import { MODULES } from "@/lib/permissions";
import { sendOrganisationInviteEmail } from "@/lib/email";

const createInviteSchema = z.object({
  email: z.string().email(),
  title: z.string().optional(),
  isAdmin: z.boolean().default(false),
  modules: z.record(z.enum(MODULES), z.boolean()).default({})
});

export async function GET(request: Request) {
  const userId = await requireUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = await requireOrganisationAdmin(userId);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const invites = await prisma.organisationInvite.findMany({
    where: { organisationId: admin.organisationId, acceptedAt: null },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ invites });
}

export async function POST(request: Request) {
  const userId = await requireUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = await requireOrganisationAdmin(userId);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = createInviteSchema.parse(await request.json());
  const email = payload.email.toLowerCase().trim();

  const existingMember = await prisma.organisationMember.findFirst({
    where: { organisationId: admin.organisationId, user: { email } }
  });
  if (existingMember) {
    return NextResponse.json({ error: "This person is already a member of your organisation." }, { status: 409 });
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const invite = await prisma.organisationInvite.create({
    data: {
      organisationId: admin.organisationId,
      email,
      title: payload.title || undefined,
      isAdmin: payload.isAdmin,
      modules: payload.modules,
      invitedByUserId: userId,
      expiresAt
    }
  });

  const baseUrl = process.env.AUTH_URL ?? "";
  await sendOrganisationInviteEmail({
    to: email,
    organisationName: admin.organisation.name,
    inviterName: admin.user.name ?? admin.user.email,
    title: payload.title || null,
    inviteUrl: `${baseUrl}/invite/${invite.token}`
  });

  return NextResponse.json({ invite }, { status: 201 });
}
