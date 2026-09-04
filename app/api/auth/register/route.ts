import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { PRESETS } from "@/lib/permissions";
import { sendWelcomeEmail } from "@/lib/email";
import { formatUserName } from "@/lib/user-display";
import { isRegisterRateLimited, recordRegisterAttempt } from "@/lib/register-rate-limit";
import { getClientIp } from "@/lib/public-token-rate-limit";

// This is specifically the "sign up and create a brand new organisation"
// flow — joining an EXISTING organisation via an invite is a separate,
// unchanged flow (see app/api/invites/[token]/accept/route.ts), which still
// collects a single free-text name rather than this first/last/job-title
// shape.
const registerSchema = z.object({
  organisationName: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  jobTitle: z.string().min(1).optional(),
  email: z.string().email(),
  password: z.string().min(8)
});

export async function POST(request: Request) {
  const payload = registerSchema.parse(await request.json());
  const email = payload.email.toLowerCase().trim();
  const ip = getClientIp(request);

  // Recorded regardless of outcome (see lib/register-rate-limit.ts) — a
  // legitimate signup only ever needs to hit this endpoint once, so unlike
  // login/token rate limiting there's no "don't penalize a genuine retry"
  // case to protect here.
  if (await isRegisterRateLimited(ip, email)) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }
  await recordRegisterAttempt(ip, email);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(payload.password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      jobTitle: payload.jobTitle,
      passwordHash,
      organisationMemberships: {
        create: {
          isAdmin: true,
          // The collected job title is what should show up on the Team
          // page's member list (OrganisationMember.title), rather than the
          // generic preset admin label this used to hardcode — falls back
          // to that preset only when jobTitle was left blank (it's optional).
          title: payload.jobTitle ?? PRESETS.admin.label,
          modules: PRESETS.admin.modules,
          organisation: {
            create: {
              name: payload.organisationName
            }
          }
        }
      }
    },
    select: { id: true, email: true, firstName: true, lastName: true }
  });

  // Fire-and-forget — a failed welcome email should never block account
  // creation, which has already succeeded by this point.
  await sendWelcomeEmail({ to: user.email, name: formatUserName(user) ?? user.email }).catch((error) => {
    console.error("Failed to send welcome email:", error);
  });

  return NextResponse.json({ user }, { status: 201 });
}
