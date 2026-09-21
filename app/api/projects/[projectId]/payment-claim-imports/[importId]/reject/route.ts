import { NextResponse } from "next/server";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { getPaymentClaimImport, rejectPaymentClaimImport } from "@/lib/payment-claim-import";

// Lets the user cancel a review without changing the project (Section 26)
// — the uploaded document and its extraction stay on file (never
// deleted), just marked rejected so it's no longer offered for review or
// confirmation.
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

  try {
    await rejectPaymentClaimImport(importId, userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not cancel this import." }, { status: 409 });
  }
}
