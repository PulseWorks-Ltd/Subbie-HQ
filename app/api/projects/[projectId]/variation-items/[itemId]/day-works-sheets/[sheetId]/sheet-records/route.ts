import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";

async function moduleForItem(projectId: string, itemId: string) {
  const item = await prisma.variationItem.findFirst({ where: { id: itemId, projectId }, select: { type: true } });
  if (!item) return null;
  return item.type === "variation" ? ("variations" as const) : ("site_instructions" as const);
}

function toNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function toNullableDate(value: unknown): Date | null {
  const str = toNullableString(value);
  if (!str) return null;
  const date = new Date(str);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Full delete+recreate on every save, same as before — matches the review
// table's "editable draft list" interaction (only saved on explicit
// confirmation). Deliberately minimal validation (Task 3.5: this is a
// low-friction review step, not a form) — sheetNumber/counts get sensible
// defaults rather than rejecting the save, and every other field is
// nullable, so nothing here can actually fail on a blank field.
export async function POST(
  request: Request,
  context: { params: { projectId: string; itemId: string; sheetId: string } }
) {
  const userId = await requireUserId(request);
  const { projectId, itemId, sheetId } = context.params;
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

  const sheet = await prisma.dayWorksSheet.findFirst({ where: { id: sheetId, variationItemId: itemId } });
  if (!sheet) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const rawRecords = Array.isArray(body?.records) ? body.records : null;
  if (!rawRecords) {
    return NextResponse.json({ error: "Missing records" }, { status: 400 });
  }

  const records = rawRecords.map((raw: Record<string, unknown>, index: number) => ({
    dayWorksSheetId: sheetId,
    sheetNumber: toNullableString(raw?.sheetNumber) ?? `Sheet ${index + 1}`,
    teamLeaderCount: Math.max(0, Math.trunc(toNullableNumber(raw?.teamLeaderCount) ?? 0)),
    teamMemberCount: Math.max(0, Math.trunc(toNullableNumber(raw?.teamMemberCount) ?? 0)),
    totalHours: toNullableNumber(raw?.totalHours),
    ratePerHour: toNullableNumber(raw?.ratePerHour),
    date: toNullableDate(raw?.date),
    startTime: toNullableString(raw?.startTime),
    finishTime: toNullableString(raw?.finishTime),
    task: toNullableString(raw?.task),
    notes: toNullableString(raw?.notes),
    weather: toNullableString(raw?.weather),
    location: toNullableString(raw?.location),
    sortOrder: index
  }));

  await prisma.$transaction([
    prisma.dayWorksSheetRecord.deleteMany({ where: { dayWorksSheetId: sheetId } }),
    ...(records.length > 0 ? [prisma.dayWorksSheetRecord.createMany({ data: records })] : [])
  ]);

  const sheetRecords = await prisma.dayWorksSheetRecord.findMany({
    where: { dayWorksSheetId: sheetId },
    orderBy: { sortOrder: "asc" }
  });

  return NextResponse.json({ sheetRecords });
}
