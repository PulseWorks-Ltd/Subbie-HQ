import { NextResponse } from "next/server";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { getPaymentClaimImport } from "@/lib/payment-claim-import";

export async function GET(request: Request, context: { params: { projectId: string; importId: string } }) {
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

  return NextResponse.json({ import: importRecord });
}
