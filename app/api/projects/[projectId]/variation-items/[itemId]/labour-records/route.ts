import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { toNullableString, toNullableNumber } from "@/lib/day-works-form-parsing";

async function moduleForItem(projectId: string, itemId: string) {
  const item = await prisma.variationItem.findFirst({ where: { id: itemId, projectId }, select: { type: true } });
  if (!item) return null;
  return item.type === "variation" ? ("variations" as const) : ("site_instructions" as const);
}

// One manually-entered labour record per request, relating directly to
// the VariationItem — no dayWorksSheetId, since this is the independent-
// of-any-sheet entry point (matching materials/plant's own manual-add
// route exactly). Saves immediately, no review-dialog step — same
// immediate-add pattern already used for Materials/Plant, not the
// AI-extraction review flow. JSON body, not multipart: unlike
// materials/plant, a labour record has no optional receipt/docket photo
// of its own.
export async function POST(request: Request, context: { params: { projectId: string; itemId: string } }) {
  const userId = await requireUserId(request);
  const { projectId, itemId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const module_ = await moduleForItem(projectId, itemId);
  if (!module_) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const canAccessModule = await requireModuleAccess(projectId, userId, module_);
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);

  // Same deliberately-low-friction validation as the AI-review save path
  // (sheet-records/route.ts) — sheetNumber/counts get sensible defaults
  // rather than rejecting the save, hours/rate are optional.
  const sheetRecord = await prisma.dayWorksSheetRecord.create({
    data: {
      variationItemId: itemId,
      sheetNumber: toNullableString(body?.sheetNumber) ?? "Sheet 1",
      teamLeaderCount: Math.max(0, Math.trunc(toNullableNumber(body?.teamLeaderCount) ?? 0)),
      teamMemberCount: Math.max(0, Math.trunc(toNullableNumber(body?.teamMemberCount) ?? 0)),
      totalHours: toNullableNumber(body?.totalHours),
      ratePerHour: toNullableNumber(body?.ratePerHour)
    }
  });

  return NextResponse.json({ sheetRecord }, { status: 201 });
}
