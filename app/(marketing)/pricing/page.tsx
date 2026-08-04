import type { Metadata } from "next";
import { auth } from "@/auth";
import { getOrganisationMembership } from "@/lib/organisation";
import { PricingView } from "@/components/billing/pricing-view";

export const metadata: Metadata = {
  title: "Subbie HQ Pricing | Plans for Subcontractors, NZ & Australia",
  description: "Simple, transparent pricing for subcontractors. Unlimited projects, users, and evidence tracking on every plan."
};

// Public, no login required — same live Stripe checkout page as before,
// now living under (marketing) for the shared header/footer. Not wrapped
// in a separate marketing-only pricing page: the marketing copy (H1,
// intro, feature table) was merged directly into PricingView instead, per
// the task's own allowance for "may need to be the same page."
export default async function PricingPage() {
  const session = await auth();
  const membership = session?.user?.id ? await getOrganisationMembership(session.user.id) : null;

  return <PricingView isLoggedIn={Boolean(session?.user?.id)} isAdmin={membership?.isAdmin ?? false} />;
}
