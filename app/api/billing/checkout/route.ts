import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth";
import { requireOrganisationAdmin } from "@/lib/organisation";
import { createCheckoutSession, PLAN_TIERS } from "@/lib/stripe";

const requestSchema = z.object({ tier: z.enum(PLAN_TIERS) });

// Starting a trial is an organisation-wide, financially consequential
// action — admin-only, same as the existing "Manage subscription" gate
// (Task 3.4) and the pilot-code redemption route.
export async function POST(request: Request) {
  const userId = await requireUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await requireOrganisationAdmin(userId);
  if (!membership) {
    return NextResponse.json({ error: "Only an organisation admin can start a plan." }, { status: 403 });
  }

  const payload = requestSchema.parse(await request.json());
  const baseUrl = process.env.AUTH_URL || new URL(request.url).origin;

  const session = await createCheckoutSession({
    tier: payload.tier,
    organisationId: membership.organisationId,
    customerEmail: membership.user.email,
    successUrl: `${baseUrl}/activate?checkout=success`,
    cancelUrl: `${baseUrl}/activate?checkout=cancelled`
  });

  if (!session.url) {
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
