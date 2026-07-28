import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, context: { params: { token: string } }) {
  const invite = await prisma.organisationInvite.findUnique({
    where: { token: context.params.token },
    include: { organisation: { select: { name: true } } }
  });

  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "This invite link is invalid or has expired." }, { status: 404 });
  }

  const existingUser = await prisma.user.findUnique({ where: { email: invite.email }, select: { id: true } });

  return NextResponse.json({
    invite: {
      email: invite.email,
      title: invite.title,
      organisationName: invite.organisation.name
    },
    hasExistingAccount: Boolean(existingUser)
  });
}
