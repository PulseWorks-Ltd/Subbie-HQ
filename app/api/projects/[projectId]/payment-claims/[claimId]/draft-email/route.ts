import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { getPaymentClaimComputedData } from "@/lib/payment-claim";
import { draftPaymentClaimEmail } from "@/lib/grok";
import { AiSpendCapExceededError } from "@/lib/ai-usage";
import { formatUserName } from "@/lib/user-display";

// Pre-Launch Feature 5 — "system auto-drafts a professional, editable
// email" before Send. Same preview-then-review shape as the existing
// updates/draft-email route: nothing is sent here, just a subject/body
// handed back for the user to edit (see the send route for the actual send).
export async function POST(request: Request, context: { params: { projectId: string; claimId: string } }) {
  const userId = await requireUserId(request);
  const { projectId, claimId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const canAccessModule = await requireModuleAccess(projectId, userId, "payment_claims");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await getPaymentClaimComputedData(projectId, claimId);
  if (!data) {
    return NextResponse.json({ error: "Payment claim not found." }, { status: 404 });
  }

  const [user, mainContractor] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, email: true } }),
    data.mainContractorId ? prisma.mainContractor.findUnique({ where: { id: data.mainContractorId }, select: { name: true } }) : null
  ]);

  try {
    const drafted = await draftPaymentClaimEmail(
      {
        projectName: data.projectName,
        mainContractorName: mainContractor?.name ?? null,
        claimNumber: data.claim.claimNumber,
        periodStart: data.claim.periodStart.toISOString().slice(0, 10),
        periodEnd: data.claim.periodEnd.toISOString().slice(0, 10),
        claimedAmount: data.figures.thisClaimGrossInclGst,
        statutoryWording: data.claim.statutoryWording,
        authorName: (user ? formatUserName(user) : null) ?? user?.email ?? "The team"
      },
      { organisationId: data.organisationId, userId }
    );
    return NextResponse.json({ drafted });
  } catch (error) {
    if (error instanceof AiSpendCapExceededError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error("Drafting Payment Claim email failed:", error);
    return NextResponse.json({ error: "Could not draft an email for this claim. You can still write it manually." }, { status: 422 });
  }
}
