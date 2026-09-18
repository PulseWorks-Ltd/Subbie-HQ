import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { requireModuleAccess } from "@/lib/auth";
import { getProjectProfitability } from "@/lib/project-profitability";
import { getActiveCommercialReviewItems, canViewCommercialReview } from "@/lib/commercial-review";
import { ProfitabilityView } from "@/components/profitability/profitability-view";

// Same permission module as Payment Claims/Contract Schedule — this page
// surfaces the same class of commercial data, so it shares their gate
// rather than inventing a new one.
export default async function ProjectProfitabilityPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const session = await auth();
  const userId = session?.user?.id;
  const canAccess = userId ? await requireModuleAccess(projectId, userId, "payment_claims") : false;
  if (!canAccess) {
    redirect(`/projects/${projectId}`);
  }

  const summary = await getProjectProfitability(projectId);
  if (!summary) {
    notFound();
  }

  const canSeeCommercialReview = userId ? await canViewCommercialReview(userId) : false;
  const commercialReviewItems =
    canSeeCommercialReview && userId ? await getActiveCommercialReviewItems(userId, projectId) : [];

  return (
    <ProfitabilityView
      summary={summary}
      commercialReviewItems={commercialReviewItems}
      showCommercialReview={canSeeCommercialReview}
    />
  );
}
