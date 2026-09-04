import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIp, isPublicTokenLookupRateLimited, recordFailedPublicTokenLookup } from "@/lib/public-token-rate-limit";

// Genuinely public — no auth of any kind, same as /api/external-actions.
// Invite tokens (OrganisationInvite.token, a plain cuid — see the schema
// comment) don't have the same 256 bits of randomness an external-action
// token does, which makes this per-IP throttle on failed lookups more load-
// bearing here than it is there, not just defense-in-depth on top of an
// already-infeasible guess space.
export async function GET(request: Request, context: { params: { token: string } }) {
  const ip = getClientIp(request);
  if (await isPublicTokenLookupRateLimited("invite", ip)) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  const invite = await prisma.organisationInvite.findUnique({
    where: { token: context.params.token },
    include: { organisation: { select: { name: true } } }
  });

  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    await recordFailedPublicTokenLookup("invite", ip);
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
