import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { generatePaymentClaimAppendixB1Pdf } from "@/lib/payment-claim-pdf";
import { getSignedDownloadUrl } from "@/lib/s3";

// Pre-Launch Feature 5 — "Preview/Download PDF" on the Payment Claim
// detail page. Always regenerated fresh from current data (not served
// from whatever was last persisted by a Send) — a claim's numbers can
// change (a new allocation, an edited contract item) right up until it's
// actually sent, and a stale download would be actively misleading.
//
// Payment Claim Import — an `imported_external` claim was never generated
// BY Subbie HQ, so generating a fresh Appendix B1 PDF for it here would
// misrepresent it as a Subbie-HQ-produced document. Serve the real
// originally-uploaded file instead (its storageKey, set once at import —
// see lib/payment-claim-import.ts's confirmPaymentClaimImport).
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

  const claim = await prisma.paymentClaim.findFirst({
    where: { id: claimId, projectId },
    select: { source: true, storageKey: true }
  });
  if (!claim) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (claim.source === "imported_external") {
    if (!claim.storageKey) {
      return NextResponse.json({ error: "The original uploaded document is not available." }, { status: 404 });
    }
    const signedUrl = await getSignedDownloadUrl(claim.storageKey);
    return NextResponse.redirect(signedUrl);
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
