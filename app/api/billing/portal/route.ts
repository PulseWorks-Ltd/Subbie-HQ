import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { requireOrganisationAdmin } from "@/lib/organisation";
import { createBillingPortalSession } from "@/lib/stripe";

export async function POST(request: Request) {
  const userId = await requireUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await requireOrganisationAdmin(userId);
  if (!membership) {
    return NextResponse.json({ error: "Only an organisation admin can manage billing." }, { status: 403 });
  }

  if (!membership.organisation.stripeCustomerId) {
    return NextResponse.json({ error: "No billing account found for this organisation yet." }, { status: 400 });
  }

  const baseUrl = process.env.AUTH_URL || new URL(request.url).origin;

  const session = await createBillingPortalSession({
    stripeCustomerId: membership.organisation.stripeCustomerId,
    returnUrl: `${baseUrl}/settings?tab=organisation`
  });

  return NextResponse.json({ url: session.url });
}
