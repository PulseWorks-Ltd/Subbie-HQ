import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { carryForwardDeclineLine, resolveDeclineLineWithoutCarryForward } from "@/lib/payment-reconciliation";

// `claimId` here is the claim that OWNS the decline line (i.e. the earlier
// claim whose contractor response declined it) — carry_forward's
// targetClaimId is a separate, later claim named in the body, never this
// route's own :claimId.
const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("carry_forward"), targetClaimId: z.string().min(1) }),
  z.object({ action: z.literal("credit"), note: z.string().nullable().optional() }),
  z.object({ action: z.literal("evidence_provided"), note: z.string().nullable().optional() }),
  z.object({ action: z.literal("resolve_other"), note: z.string().nullable().optional() })
]);

export async function PATCH(
  request: Request,
  context: { params: { projectId: string; claimId: string; declineLineId: string } }
) {
  const userId = await requireUserId(request);
  const { projectId, claimId, declineLineId } = context.params;
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

  const declineLine = await prisma.paymentReconciliationDeclineLine.findFirst({
    where: { id: declineLineId, contractorPaymentSchedule: { paymentClaimId: claimId, paymentClaim: { projectId } } }
  });
  if (!declineLine) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const payload = parsed.data;

  try {
    if (payload.action === "carry_forward") {
      // Only ever into a DRAFT claim, in the SAME project — carrying an
      // amount into an already-issued claim would misrepresent what was
      // actually submitted (Section: carryForwardDeclineLine's own
      // comment). Checked here, at the route, rather than inside the lib
      // function, since "which claims are valid targets" is a request-time
      // authorization concern, not a reconciliation calculation.
      const targetClaim = await prisma.paymentClaim.findFirst({
        where: { id: payload.targetClaimId, projectId },
        select: { status: true }
      });
      if (!targetClaim) {
        return NextResponse.json({ error: "Target claim not found." }, { status: 404 });
      }
      if (targetClaim.status !== "draft") {
        return NextResponse.json({ error: "You can only carry a decline forward into a claim that hasn't been sent yet." }, { status: 409 });
      }
      await carryForwardDeclineLine({ declineLineId, targetClaimId: payload.targetClaimId, userId });
    } else {
      const resolution = payload.action === "credit" ? "credited" : payload.action === "evidence_provided" ? "evidence_provided" : "resolved_other";
      await resolveDeclineLineWithoutCarryForward({ declineLineId, resolution, note: payload.note ?? null, userId });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not resolve this decline." }, { status: 409 });
  }
}
