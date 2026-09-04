import { NextResponse } from "next/server";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { generatePaymentClaimAppendixB1Pdf } from "@/lib/payment-claim-pdf";

// Pre-Launch Feature 5 — "Preview/Download PDF" on the Payment Claim
// detail page. Always regenerated fresh from current data (not served
// from whatever was last persisted by a Send) — a claim's numbers can
// change (a new allocation, an edited contract item) right up until it's
// actually sent, and a stale download would be actively misleading.
export async function GET(request: Request, context: { params: { projectId: string; claimId: string } }) {
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

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await generatePaymentClaimAppendixB1Pdf(projectId, claimId);
  } catch (error) {
    console.error("Payment Claim PDF generation failed:", error);
    return NextResponse.json({ error: "Could not generate the Payment Claim PDF." }, { status: 404 });
  }

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="payment-claim-${claimId}.pdf"`
    }
  });
}
