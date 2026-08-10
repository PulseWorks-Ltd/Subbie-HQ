import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { toNullableString, toNullableNumber, toNullableDate } from "@/lib/day-works-form-parsing";

async function moduleForItem(projectId: string, itemId: string) {
  const item = await prisma.variationItem.findFirst({ where: { id: itemId, projectId }, select: { type: true } });
  if (!item) return null;
  return item.type === "variation" ? ("variations" as const) : ("site_instructions" as const);
}

type RawSheetRecord = Record<string, unknown>;
type RawLineItem = {
  description?: unknown;
  quantity?: unknown;
  unit?: unknown;
  unitCost?: unknown;
  sourceFileName?: unknown;
  sourceStorageKey?: unknown;
  sourceContentType?: unknown;
};
type RawDayWorksSheet = {
  fileName?: unknown;
  storageKey?: unknown;
  contentType?: unknown;
  records?: unknown;
};

// The unified review-before-save action (Task 6.2) — the only place any
// of the files classified/reviewed by .../labour-plant-material/classify
// actually become real DayWorksSheet/DayWorksMaterial/DayWorksPlant rows.
// Everything the client sends here is already-uploaded (real S3 objects,
// from the classify step) and already human-reviewed — this route just
// persists it, same "nothing here can actually fail on a blank field"
// permissiveness as the original sheet-records save route, reusing its
// exact field-normalization rules (lib/day-works-form-parsing.ts).
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
  const rawSheets: RawDayWorksSheet[] = Array.isArray(body?.dayWorksSheets) ? body.dayWorksSheets : [];
  const rawMaterials: RawLineItem[] = Array.isArray(body?.materials) ? body.materials : [];
  const rawPlant: RawLineItem[] = Array.isArray(body?.plant) ? body.plant : [];

  if (rawSheets.length === 0 && rawMaterials.length === 0 && rawPlant.length === 0) {
    return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
  }

  function toLineItemData(raw: RawLineItem) {
    return {
      variationItemId: itemId,
      description: toNullableString(raw.description) ?? "Untitled item",
      quantity: Math.max(0, toNullableNumber(raw.quantity) ?? 0),
      unit: toNullableString(raw.unit) ?? "each",
      unitCost: Math.max(0, toNullableNumber(raw.unitCost) ?? 0),
      photoFileName: toNullableString(raw.sourceFileName),
      photoStorageKey: toNullableString(raw.sourceStorageKey),
      photoContentType: toNullableString(raw.sourceContentType)
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    const createdSheets = [];
    for (const rawSheet of rawSheets) {
      const fileName = toNullableString(rawSheet.fileName);
      const storageKey = toNullableString(rawSheet.storageKey);
      const contentType = toNullableString(rawSheet.contentType);
      if (!fileName || !storageKey) continue;

      const sheet = await tx.dayWorksSheet.create({
        data: { variationItemId: itemId, fileName, storageKey, contentType }
      });

      const rawRecords = Array.isArray(rawSheet.records) ? (rawSheet.records as RawSheetRecord[]) : [];
      if (rawRecords.length > 0) {
        await tx.dayWorksSheetRecord.createMany({
          data: rawRecords.map((raw, index) => ({
            variationItemId: itemId,
            dayWorksSheetId: sheet.id,
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
          }))
        });
      }
      createdSheets.push(sheet);
    }

    const createdMaterials =
      rawMaterials.length > 0
        ? await tx.dayWorksMaterial
            .createMany({ data: rawMaterials.map(toLineItemData) })
            .then(() => tx.dayWorksMaterial.findMany({ where: { variationItemId: itemId }, orderBy: { createdAt: "desc" }, take: rawMaterials.length }))
        : [];

    const createdPlant =
      rawPlant.length > 0
        ? await tx.dayWorksPlant
            .createMany({ data: rawPlant.map(toLineItemData) })
            .then(() => tx.dayWorksPlant.findMany({ where: { variationItemId: itemId }, orderBy: { createdAt: "desc" }, take: rawPlant.length }))
        : [];

    return { sheetCount: createdSheets.length, materialsCount: createdMaterials.length, plantCount: createdPlant.length };
  });

  return NextResponse.json(result, { status: 201 });
}
