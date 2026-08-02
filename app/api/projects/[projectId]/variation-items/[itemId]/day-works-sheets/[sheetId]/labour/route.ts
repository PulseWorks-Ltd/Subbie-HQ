import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";

async function moduleForItem(projectId: string, itemId: string) {
  const item = await prisma.variationItem.findFirst({ where: { id: itemId, projectId }, select: { type: true } });
  if (!item) return null;
  return item.type === "variation" ? ("variations" as const) : ("site_instructions" as const);
}

const VALID_RATE_TYPES = new Set(["normal", "night", "sunday_holiday"]);

// Full delete+recreate on every save — matches the review table's "editable
// draft list" interaction (Task 2.2: only saved on explicit confirmation),
// and there's no reason to reconcile a diff against the previous saved set
// when the user has just reviewed and confirmed the complete list.
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
  const rawEntries = Array.isArray(body?.entries) ? body.entries : null;
  if (!rawEntries) {
    return NextResponse.json({ error: "Missing entries" }, { status: 400 });
  }

  const entries: {
    workerName: string;
    date: Date;
    startTime: string | null;
    endTime: string | null;
    hours: number;
    rateType: "normal" | "night" | "sunday_holiday";
    taskDescription: string | null;
    sortOrder: number;
  }[] = [];

  for (let i = 0; i < rawEntries.length; i++) {
    const raw = rawEntries[i];
    const workerName = typeof raw?.workerName === "string" ? raw.workerName.trim() : "";
    const date = typeof raw?.date === "string" ? new Date(raw.date) : null;
    const hours = Number(raw?.hours);
    const rateType = typeof raw?.rateType === "string" ? raw.rateType : "";

    if (!workerName || !date || Number.isNaN(date.getTime()) || !Number.isFinite(hours) || hours <= 0 || !VALID_RATE_TYPES.has(rateType)) {
      return NextResponse.json(
        { error: `Entry ${i + 1}: worker name, date, hours (> 0), and rate type are all required.` },
        { status: 400 }
      );
    }

    entries.push({
      workerName,
      date,
      startTime: typeof raw.startTime === "string" && raw.startTime.trim() ? raw.startTime.trim() : null,
      endTime: typeof raw.endTime === "string" && raw.endTime.trim() ? raw.endTime.trim() : null,
      hours,
      rateType: rateType as "normal" | "night" | "sunday_holiday",
      taskDescription: typeof raw.taskDescription === "string" && raw.taskDescription.trim() ? raw.taskDescription.trim() : null,
      sortOrder: i
    });
  }

  await prisma.$transaction([
    prisma.dayWorksLabourEntry.deleteMany({ where: { dayWorksSheetId: sheetId } }),
    ...(entries.length > 0
      ? [
          prisma.dayWorksLabourEntry.createMany({
            data: entries.map((entry) => ({ ...entry, dayWorksSheetId: sheetId }))
          })
        ]
      : [])
  ]);

  const labourEntries = await prisma.dayWorksLabourEntry.findMany({
    where: { dayWorksSheetId: sheetId },
    orderBy: { sortOrder: "asc" }
  });

  return NextResponse.json({ labourEntries });
}
