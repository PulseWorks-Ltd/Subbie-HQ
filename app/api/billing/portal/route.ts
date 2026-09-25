import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { requireOrganisationAdmin } from "@/lib/organisation";
import { prisma } from "@/lib/prisma";
import { createBillingPortalSession, isMissingStripeCustomer } from "@/lib/stripe";

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

  try {
    const session = await createBillingPortalSession({
      stripeCustomerId: membership.organisation.stripeCustomerId,
      returnUrl: `${baseUrl}/settings?tab=organisation`
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (!isMissingStripeCustomer(error)) throw error;
    // The saved customer belongs to a different Stripe account (the Stripe
    // keys were switched to a new account, or from test mode to live), so
    // it can never be managed here. Forget the stale Stripe ids so the
    // settings page offers "Upgrade to a paid plan" again, and checkout
    // makes a customer in the current account. accessStatus is left as it
    // is on purpose: this must never lock anyone out.
    console.warn(
      `Billing portal: customer ${membership.organisation.stripeCustomerId} isn't in this Stripe account; clearing it for organisation ${membership.organisationId}.`
    );
    await prisma.organisation.update({
      where: { id: membership.organisationId },
      data: { stripeCustomerId: null, stripeSubscriptionId: null }
    });
    return NextResponse.json(
      {
        error:
          "Your subscription was set up with our previous billing account, so it can't be managed here. Please choose a plan again from the Pricing page — or contact us if you think you're being charged twice.",
        billingReset: true
      },
      { status: 409 }
    );
  }
}
