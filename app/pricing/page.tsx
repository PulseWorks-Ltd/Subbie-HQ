import { auth } from "@/auth";
import { getOrganisationMembership } from "@/lib/organisation";
import { PricingView } from "@/components/billing/pricing-view";

// Deliberately outside the (app) route group — public, no login required
// (Task 2.2), same "standalone route, don't inherit app-shell assumptions"
// reasoning as /platform-admin and /activate.
export default async function PricingPage() {
  const session = await auth();
  const membership = session?.user?.id ? await getOrganisationMembership(session.user.id) : null;

  return <PricingView isLoggedIn={Boolean(session?.user?.id)} isAdmin={membership?.isAdmin ?? false} />;
}
