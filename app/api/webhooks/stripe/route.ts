import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { constructWebhookEvent, mapStripeStatusToAccessStatus, getPlanTierForPriceId } from "@/lib/stripe";
import { recordAccessStatusChange } from "@/lib/organisation-access-log";

// Stripe needs the raw, unparsed request body to verify the signature —
// Next.js route handlers normally consume/parse the body automatically,
// so this must stay a route (not a Server Action) reading request.text().
export const dynamic = "force-dynamic";

function customerIdOf(customer: string | Stripe.Customer | Stripe.DeletedCustomer): string {
  return typeof customer === "string" ? customer : customer.id;
}

// The authoritative source of truth for Organisation.accessStatus (see
// prisma/schema.prisma's comment on that field) — the checkout redirect
// (app/api/billing/checkout/route.ts's success_url) is only ever a
// "looks like it probably worked, refresh soon" hint to the browser, never
// trusted to itself set access state, since the user can close the tab
// before the redirect happens at all.
async function syncSubscriptionStatus(subscription: Stripe.Subscription, source: string): Promise<void> {
  const accessStatus = mapStripeStatusToAccessStatus(subscription.status);
  if (!accessStatus) return;

  const customerId = customerIdOf(subscription.customer);
  const priceId = subscription.items.data[0]?.price.id;
  const planTier = priceId ? getPlanTierForPriceId(priceId) : null;

  // Read the existing row first (rather than a blind updateMany) so the
  // access-event log below knows what status this org is transitioning
  // FROM — see lib/organisation-access-log.ts.
  const existing = await prisma.organisation.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true, accessStatus: true }
  });

  if (!existing) {
    // Expected immediately after a fresh checkout, if this event somehow
    // races ahead of checkout.session.completed (which is what first sets
    // stripeCustomerId) — logged, not thrown, since Stripe will retry
    // subsequent events and checkout.session.completed backfills the link.
    console.error(`Stripe webhook: no organisation found for customer ${customerId} (subscription ${subscription.id}).`);
    return;
  }

  await prisma.organisation.update({
    where: { id: existing.id },
    data: {
      accessStatus,
      stripeSubscriptionId: subscription.id,
      ...(planTier ? { planTier } : {}),
      trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null
    }
  });

  await recordAccessStatusChange({
    organisationId: existing.id,
    fromStatus: existing.accessStatus,
    toStatus: accessStatus,
    planTier,
    source
  });
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(rawBody, signature);
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const organisationId = session.metadata?.organisationId;
      const planTier = session.metadata?.planTier;
      const stripeCustomerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
      const stripeSubscriptionId =
        typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

      if (!organisationId || !stripeCustomerId || !stripeSubscriptionId) {
        console.error("Stripe webhook: checkout.session.completed missing expected fields", {
          organisationId,
          stripeCustomerId,
          stripeSubscriptionId
        });
        break;
      }

      try {
        const existing = await prisma.organisation.findUnique({
          where: { id: organisationId },
          select: { accessStatus: true }
        });

        await prisma.organisation.update({
          where: { id: organisationId },
          data: {
            stripeCustomerId,
            stripeSubscriptionId,
            planTier: planTier as "starter" | "professional" | "enterprise" | undefined,
            // trialing is set here as an immediate best-effort — the
            // customer.subscription.created event (Stripe fires this right
            // after checkout completes, not .updated — confirmed by
            // testing) re-confirms the real status and backfills
            // trialEndsAt via syncSubscriptionStatus, so this is never the
            // only write.
            accessStatus: "trialing"
          }
        });

        await recordAccessStatusChange({
          organisationId,
          fromStatus: existing?.accessStatus ?? null,
          toStatus: "trialing",
          planTier: (planTier as "starter" | "professional" | "enterprise" | undefined) ?? null,
          source: "stripe_checkout"
        });
      } catch (error) {
        console.error(`Stripe webhook: failed to link checkout session to organisation ${organisationId}:`, error);
      }
      break;
    }

    case "customer.subscription.created": {
      const subscription = event.data.object as Stripe.Subscription;
      await syncSubscriptionStatus(subscription, "stripe_subscription_created");
      break;
    }
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      await syncSubscriptionStatus(subscription, "stripe_subscription_updated");
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await syncSubscriptionStatus(subscription, "stripe_subscription_deleted");
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
