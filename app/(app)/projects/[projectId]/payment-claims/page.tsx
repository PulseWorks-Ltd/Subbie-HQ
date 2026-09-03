import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/auth";
import { PaymentClaimsListView } from "@/components/payment-claims/payment-claims-list-view";
import { getRetentionSummary } from "@/lib/retention";

export default async function PaymentClaimsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const session = await auth();
  const userId = session?.user?.id;
  const canAccess = userId ? await requireModuleAccess(projectId, userId, "payment_claims") : false;
  if (!canAccess) {
    redirect(`/projects/${projectId}`);
  }

  const [claims, retentionSummary] = await Promise.all([
    prisma.paymentClaim.findMany({
      where: { projectId },
      orderBy: { claimNumber: "desc" }
    }),
    getRetentionSummary(projectId)
  ]);

  return <PaymentClaimsListView projectId={projectId} claims={claims} retentionSummary={retentionSummary} />;
}
