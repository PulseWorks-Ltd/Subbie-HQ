import { NextResponse } from "next/server";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { getPaymentClaimImport, confirmPaymentClaimImport } from "@/lib/payment-claim-import";

// "Confirm & Import" (Section 8 — deliberately not "Save AI Results": this
// establishes a real commercial baseline). The only action that changes
// canonical project data; everything before this point is a reviewable
// draft. Runs as one transaction (Section 32) — confirmPaymentClaimImport
// itself is all-or-nothing.
export async function POST(request: Request, context: { params: { projectId: string; importId: string } }) {
  const userId = await requireUserId(request);
  const { projectId, importId } = context.params;
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

  const importRecord = await getPaymentClaimImport(importId);
  if (!importRecord || importRecord.projectId !== projectId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const baselineDateRaw = typeof body?.baselineDate === "string" ? new Date(body.baselineDate) : null;
  const baselineDate = baselineDateRaw && !Number.isNaN(baselineDateRaw.getTime()) ? baselineDateRaw : undefined;

  // Distinguishes "the review screen didn't address claim numbering at all"
  // (key absent) from "the user cleared the field" (explicit null, meaning
  // auto-number) — see confirmPaymentClaimImport's own precedence comment.
  const hasClaimNumberField = body && typeof body === "object" && "claimNumber" in body;
  const claimNumber = hasClaimNumberField
    ? typeof body.claimNumber === "number" && Number.isInteger(body.claimNumber)
      ? body.claimNumber
      : null
    : undefined;

  try {
    const result = await confirmPaymentClaimImport(
      importId,
      userId,
      hasClaimNumberField ? { baselineDate, claimNumber } : { baselineDate }
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not import this payment claim." }, { status: 409 });
  }
}
