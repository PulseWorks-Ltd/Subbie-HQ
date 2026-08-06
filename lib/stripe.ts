import Stripe from "stripe";
import type { AccessStatus } from "@prisma/client";

// Constructed lazily, not at module scope — same reasoning as
// lib/grok.ts's getClient(): eagerly validating STRIPE_SECRET_KEY at
// import time would crash Next.js's build-time page-data collection if
// this module is ever imported before the key is configured.
function getClient(): Stripe {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }
  return new Stripe(apiKey);
}

// Plain string union, not just a type alias of the Prisma enum — mirrors
// this codebase's established pattern (see lib/ai-usage.ts's AiFeature) of
// keeping app-facing code decoupled from the generated Prisma types where
// it's used outside direct DB reads/writes (e.g. as a zod enum below).
export const PLAN_TIERS = ["starter", "professional", "enterprise"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

export const PLAN_DISPLAY: Record<PlanTier, { label: string; priceUsd: number; description: string }> = {
  starter: {
    label: "Starter",
    priceUsd: 49,
    description: "For a single project or two — core contract review and variation tools."
  },
  professional: {
    label: "Professional",
    priceUsd: 149,
    description: "For growing subcontractors — higher AI usage allowance across more active projects."
  },
  enterprise: {
    label: "Enterprise",
    priceUsd: 249,
    description: "For larger operations — our highest AI usage allowance and priority support."
  }
};

// Real Stripe Price IDs live in env vars, never hardcoded (see
// IMPLEMENTATION RULES) — these must be created in Stripe test mode first
// (see docs/staging.md or the task's own setup instructions) and match
// PLAN_DISPLAY's prices exactly, since Stripe's Price object is the actual
// source of truth for what gets charged; PLAN_DISPLAY is display-only.
const PRICE_ID_ENV_VAR: Record<PlanTier, string> = {
  starter: "STRIPE_PRICE_STARTER",
  professional: "STRIPE_PRICE_PROFESSIONAL",
  enterprise: "STRIPE_PRICE_ENTERPRISE"
};

export function getPriceId(tier: PlanTier): string {
  const envVar = PRICE_ID_ENV_VAR[tier];
  const priceId = process.env[envVar];
  if (!priceId) {
    throw new Error(`${envVar} is not configured.`);
  }
  return priceId;
}

// Reverse lookup used by the webhook (a subscription event carries a Price
// ID, not a tier) — built fresh per call rather than at module scope so it
// always reflects the current env, same lazy-construction reasoning as
// getClient() above.
export function getPlanTierForPriceId(priceId: string): PlanTier | null {
  for (const tier of PLAN_TIERS) {
    if (process.env[PRICE_ID_ENV_VAR[tier]] === priceId) return tier;
  }
  return null;
}

const TRIAL_PERIOD_DAYS = 14;

// One Checkout Session per "Start free trial" click (see
// app/api/billing/checkout/route.ts) — organisationId in metadata is how
// the webhook's checkout.session.completed handler links the resulting
// Stripe customer/subscription back to the right Organisation row; every
// subsequent subscription lifecycle event is then resolved via
// stripeCustomerId instead (set once here), not metadata again.
export async function createCheckoutSession(params: {
  tier: PlanTier;
  organisationId: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  const stripe = getClient();
  return stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: getPriceId(params.tier), quantity: 1 }],
    subscription_data: {
      trial_period_days: TRIAL_PERIOD_DAYS
    },
    metadata: { organisationId: params.organisationId, planTier: params.tier },
    customer_email: params.customerEmail,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl
  });
}

// Stripe's hosted Billing Portal — self-serve cancel/upgrade/downgrade,
// configured in the Stripe dashboard/API rather than custom UI (Task 3.4).
// STRIPE_PORTAL_CONFIGURATION_ID points at a configuration created
// specifically for Subbie HQ (plan switching enabled, scoped to only our 3
// products/prices) — this Stripe account is shared with other, unrelated
// products, and the account's default portal configuration is already in
// use by those, so a dedicated configuration keeps Subbie HQ's portal
// behavior (and which plans a customer can switch between) fully isolated
// from them rather than editing shared account-wide settings.
export async function createBillingPortalSession(params: {
  stripeCustomerId: string;
  returnUrl: string;
}): Promise<Stripe.BillingPortal.Session> {
  const stripe = getClient();
  const configurationId = process.env.STRIPE_PORTAL_CONFIGURATION_ID;
  return stripe.billingPortal.sessions.create({
    customer: params.stripeCustomerId,
    return_url: params.returnUrl,
    ...(configurationId ? { configuration: configurationId } : {})
  });
}

export function constructWebhookEvent(payload: string, signature: string): Stripe.Event {
  const stripe = getClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
  }
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

// Maps Stripe's own subscription lifecycle states onto this app's
// AccessStatus. incomplete/incomplete_expired/paused are deliberately
// mapped to null (no change) rather than guessed at — incomplete in
// particular is a normal transient state Stripe uses while a first
// payment is still being confirmed, not a real access decision point.
export function mapStripeStatusToAccessStatus(status: Stripe.Subscription.Status): AccessStatus | null {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    case "incomplete":
    case "paused":
    default:
      return null;
  }
}
