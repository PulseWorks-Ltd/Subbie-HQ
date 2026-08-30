import type { AccessStatus, PlanTier } from "@prisma/client";
import { prisma } from "./prisma";

// Single source of truth for logging an Organisation.accessStatus
// transition — called from the 3 places (and only the 3 places)
// accessStatus is ever actually written: pilot code redemption
// (app/api/billing/pilot-code/route.ts) and the two Stripe webhook paths
// (app/api/webhooks/stripe/route.ts). Deliberately a no-op when the status
// hasn't actually changed, so e.g. a customer.subscription.updated event
// that only touches something else (trialEndsAt, a metadata field) doesn't
// clutter the timeline with a same-to-same entry.
export async function recordAccessStatusChange(params: {
  organisationId: string;
  fromStatus: AccessStatus | null;
  toStatus: AccessStatus;
  planTier: PlanTier | null;
  source: string;
}): Promise<void> {
  if (params.fromStatus === params.toStatus) return;

  await prisma.organisationAccessEvent.create({
    data: {
      organisationId: params.organisationId,
      fromStatus: params.fromStatus,
      toStatus: params.toStatus,
      planTier: params.planTier,
      source: params.source
    }
  });
}
