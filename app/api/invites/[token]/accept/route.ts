import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { splitFullName } from "@/lib/user-display";
import { getClientIp, isPublicTokenLookupRateLimited, recordFailedPublicTokenLookup } from "@/lib/public-token-rate-limit";

const acceptInviteSchema = z.object({
  name: z.string().min(1).optional(),
  password: z.string().min(8).optional()
});

// Same per-IP throttle as GET ../route.ts, on the same "invite" scope —
// deliberately shared budget across GET/POST for a given token guesser
// rather than each handler getting its own independent 20 attempts.
export async function POST(request: Request, context: { params: { token: string } }) {
  const ip = getClientIp(request);
  if (await isPublicTokenLookupRateLimited("invite", ip)) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  const invite = await prisma.organisationInvite.findUnique({
    where: { token: context.params.token }
  });

  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    await recordFailedPublicTokenLookup("invite", ip);
    return NextResponse.json({ error: "This invite link is invalid or has expired." }, { status: 404 });
  }

  const payload = acceptInviteSchema.parse(await request.json().catch(() => ({})));
  const existingUser = await prisma.user.findUnique({ where: { email: invite.email } });

  let userId: string;

  if (existingUser) {
    const sessionUserId = await requireUserId(request);
    if (sessionUserId !== existingUser.id) {
      return NextResponse.json(
        { error: "An account already exists for this email. Please log in first, then open this invite link again." },
        { status: 409 }
      );
    }
    userId = existingUser.id;
  } else {
    if (!payload.name || !payload.password) {
      return NextResponse.json({ error: "Name and password are required." }, { status: 400 });
    }
    const passwordHash = await bcrypt.hash(payload.password, 10);
    // This flow still collects a single free-text "Your name" field (see
    // components/invite/accept-invite-form.tsx) — deliberately unchanged
    // per Task 1.3, just adapted to write into firstName/lastName using the
    // same best-effort split as the migration's backfill.
    const { firstName, lastName } = splitFullName(payload.name);
    const user = await prisma.user.create({
      data: { email: invite.email, firstName, lastName, passwordHash }
    });
    userId = user.id;
  }

  const existingMembership = await prisma.organisationMember.findUnique({
    where: { organisationId_userId: { organisationId: invite.organisationId, userId } }
  });

  if (!existingMembership) {
    await prisma.organisationMember.create({
      data: {
        organisationId: invite.organisationId,
        userId,
        title: invite.title,
        isAdmin: invite.isAdmin,
        modules: invite.modules as object
      }
    });
  }

  await prisma.organisationInvite.update({
    where: { id: invite.id },
    data: { acceptedAt: new Date() }
  });

  return NextResponse.json({ ok: true, isNewAccount: !existingUser });
}
