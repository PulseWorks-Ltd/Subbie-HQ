import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { getContractScheduleForProject, computeScheduleClaimBreakdown, sumBreakdown } from "@/lib/contract-schedule";
import { recomputeClaimTotal } from "@/lib/payment-claim";

export async function GET(request: Request, context: { params: { projectId: string } }) {
  const userId = await requireUserId(request);
  const { projectId } = context.params;
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

  // claimEvidenceLinks (not the legacy evidenceLinks/EvidencePaymentClaim
  // relation — see PaymentClaim's own schema comment) is the real, live
  // evidence chain this route should always have shown.
  const claims = await prisma.paymentClaim.findMany({
    where: { projectId },
    include: { claimEvidenceLinks: true },
    orderBy: { claimNumber: "desc" }
  });

  return NextResponse.json({ claims });
}

const createClaimSchema = z.object({
  periodStart: z.string(), // ISO date
  periodEnd: z.string()
});

// The real claim-creation path — deliberately separate from this same
// directory's generate/route.ts, which pre-dates this feature, sums two
// orphaned legacy models nothing else writes to (MonthlyWorkRecord,
// Variation), and isn't called by any real UI (see that route's own
// comment, and subbie-hq-outstanding-roadmap.md §1). Left in place
// untouched rather than repurposed, per this codebase's "never delete,
// build the real thing alongside" convention. This route computes
// contractWorksAmount from the real Contract Schedule of Values instead —
// see lib/contract-schedule.ts.
export async function POST(request: Request, context: { params: { projectId: string } }) {
  const userId = await requireUserId(request);
  const { projectId } = context.params;
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

  const payload = createClaimSchema.parse(await request.json());
  const periodStart = new Date(payload.periodStart);
  const periodEnd = new Date(payload.periodEnd);
  if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime()) || periodEnd < periodStart) {
    return NextResponse.json({ error: "Invalid claim period." }, { status: 400 });
  }

  const [latestClaim, schedule] = await Promise.all([
    prisma.paymentClaim.findFirst({ where: { projectId }, orderBy: { claimNumber: "desc" } }),
    getContractScheduleForProject(projectId)
  ]);

  // The previous claim's period-end is the cutoff "claimed to date so far"
  // is measured against, so this claim's amount is exactly the NEW work
  // since then — not a guess, the same claimedToDate(a) - claimedToDate(b)
  // maths computeScheduleClaimBreakdown always uses.
  const previousPeriodEnd = latestClaim?.periodEnd ?? null;
  const contractWorksAmount = schedule
    ? sumBreakdown(computeScheduleClaimBreakdown(schedule, periodStart, periodEnd, previousPeriodEnd)).thisClaim
    : 0;

  const claim = await prisma.paymentClaim.create({
    data: {
      projectId,
      claimNumber: (latestClaim?.claimNumber ?? 0) + 1,
      referenceDate: periodEnd,
      periodStart,
      periodEnd,
      claimMonth: `${periodEnd.getUTCFullYear()}-${String(periodEnd.getUTCMonth() + 1).padStart(2, "0")}`,
      contractWorksAmount,
      statutoryWording: "This is a payment claim made under the Construction Contracts Act 2002."
    }
  });
  await recomputeClaimTotal(claim.id);

  return NextResponse.json({ claim }, { status: 201 });
}
