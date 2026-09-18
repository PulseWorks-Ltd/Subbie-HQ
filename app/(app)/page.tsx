import type { Metadata } from "next";
import { auth } from "@/auth";
import { getDashboardFeed } from "@/lib/dashboard";
import { getUnreadUpdates } from "@/lib/updates-feed";
import { getActiveCommercialReviewItems, canViewCommercialReview } from "@/lib/commercial-review";
import { getPortfolioProfitabilitySummary } from "@/lib/project-profitability";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { HomepageView } from "@/components/marketing/homepage-view";

// Logged-out visitors see the public marketing homepage instead of a
// login redirect; logged-in visitors see the Dashboard exactly as before.
// Both live at "/" since Next.js can't resolve two page.tsx files to the
// same URL, so this file — not a route group — is the branch point.
export async function generateMetadata(): Promise<Metadata> {
  const session = await auth();
  if (session?.user?.id) {
    return {};
  }

  return {
    title: "Subbie HQ | Contract & Commercial Management for Subcontractors",
    description:
      "Subbie HQ helps NZ and Australian subcontractors understand their contracts, manage Site Instructions and Variations, and prepare payment claims with confidence."
  };
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return <HomepageView />;
  }

  const [items, unreadUpdates, canSeeCommercialReview] = await Promise.all([
    getDashboardFeed(session.user.id),
    getUnreadUpdates(session.user.id),
    canViewCommercialReview(session.user.id)
  ]);
  const commercialReviewItems = canSeeCommercialReview ? await getActiveCommercialReviewItems(session.user.id) : [];
  // getPortfolioProfitabilitySummary itself checks canViewPortfolioProfitability
  // (isAdmin-gated) and returns null for anyone else — called unconditionally
  // here, same pattern requireProjectAccess-style helpers use elsewhere.
  const portfolioProfitability = await getPortfolioProfitabilitySummary(session.user.id);

  return (
    <DashboardView
      initialItems={items}
      initialUnreadUpdates={unreadUpdates}
      initialCommercialReviewItems={commercialReviewItems}
      showCommercialReview={canSeeCommercialReview}
      portfolioProfitability={portfolioProfitability}
    />
  );
}
