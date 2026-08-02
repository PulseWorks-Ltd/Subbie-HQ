import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { downloadFromS3 } from "@/lib/s3";
import { extractImageTextWithOcr, extractPdfPagesWithOcrFallback, UnreadablePdfError } from "@/lib/pdf-text-extraction";
import { extractDayWorksLabourFromText } from "@/lib/grok";
import { AiSpendCapExceededError } from "@/lib/ai-usage";
import { resolveRateSegments, resolveRateTypeForHoursOnly } from "@/lib/day-works-rates";
import type { DayWorksRateType } from "@prisma/client";

async function moduleForItem(projectId: string, itemId: string) {
  const item = await prisma.variationItem.findFirst({ where: { id: itemId, projectId }, select: { type: true } });
  if (!item) return null;
  return item.type === "variation" ? ("variations" as const) : ("site_instructions" as const);
}

export type DraftLabourEntry = {
  workerName: string;
  date: string; // YYYY-MM-DD
  startTime: string | null;
  endTime: string | null;
  hours: number | null;
  rateType: DayWorksRateType;
  taskDescription: string | null;
};

function isValidIsoDate(value: string | null): value is string {
  if (!value) return false;
  return !Number.isNaN(new Date(value).getTime());
}

// Most sheets show a single date for the whole record — extraction may
// return it on some lines and not others (or not at all). Falls back to
// today, flagged via the returned warning, only if genuinely no entry has
// a legible date.
function resolveSheetDate(entries: { date: string | null }[]): { date: string; usedFallback: boolean } {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (!isValidIsoDate(entry.date)) continue;
    counts.set(entry.date, (counts.get(entry.date) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [date, count] of counts) {
    if (count > bestCount) {
      best = date;
      bestCount = count;
    }
  }
  if (best) return { date: best, usedFallback: false };
  return { date: new Date().toISOString().slice(0, 10), usedFallback: true };
}

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

  try {
    const buffer = await downloadFromS3(sheet.storageKey);

    let text: string;
    if (sheet.contentType === "application/pdf") {
      const pages = await extractPdfPagesWithOcrFallback(buffer);
      text = pages.map((p) => p.text).join("\n\n");
    } else if (sheet.contentType?.startsWith("image/")) {
      text = await extractImageTextWithOcr(buffer);
    } else {
      return NextResponse.json(
        { error: "This file type can't be read automatically. Please add labour entries manually." },
        { status: 422 }
      );
    }

    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { organisationId: true } });
    const rawEntries = await extractDayWorksLabourFromText(text, {
      organisationId: project?.organisationId ?? null,
      userId,
      contextRef: sheetId
    });

    const { date: fallbackDate, usedFallback } = resolveSheetDate(rawEntries);

    const draftEntries: DraftLabourEntry[] = [];
    for (const raw of rawEntries) {
      const entryDate = isValidIsoDate(raw.date) ? raw.date : fallbackDate;
      const dateObj = new Date(entryDate);

      if (raw.startTime && raw.endTime) {
        const segments = resolveRateSegments(dateObj, raw.startTime, raw.endTime);
        if (segments.length > 0) {
          for (const segment of segments) {
            draftEntries.push({
              workerName: raw.workerName,
              date: entryDate,
              startTime: raw.startTime,
              endTime: raw.endTime,
              hours: segment.hours,
              rateType: segment.rateType,
              taskDescription: raw.taskDescription
            });
          }
          continue;
        }
      }

      if (raw.totalHours != null) {
        draftEntries.push({
          workerName: raw.workerName,
          date: entryDate,
          startTime: raw.startTime,
          endTime: raw.endTime,
          hours: raw.totalHours,
          rateType: resolveRateTypeForHoursOnly(dateObj),
          taskDescription: raw.taskDescription
        });
        continue;
      }

      draftEntries.push({
        workerName: raw.workerName,
        date: entryDate,
        startTime: raw.startTime,
        endTime: raw.endTime,
        hours: null,
        rateType: resolveRateTypeForHoursOnly(dateObj),
        taskDescription: raw.taskDescription
      });
    }

    const warning = usedFallback
      ? `Could not determine a date anywhere on this sheet — defaulted to ${fallbackDate}. Please check the date and every entry below before saving.`
      : draftEntries.some((e) => e.hours === null)
        ? "Some entries are missing hours — fill them in before saving."
        : null;

    return NextResponse.json({ entries: draftEntries, warning });
  } catch (error) {
    if (error instanceof AiSpendCapExceededError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    const message =
      error instanceof UnreadablePdfError
        ? "This file's text couldn't be read automatically, even with OCR. Please add labour entries manually."
        : "Could not read this document automatically. You can still add labour entries manually.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
