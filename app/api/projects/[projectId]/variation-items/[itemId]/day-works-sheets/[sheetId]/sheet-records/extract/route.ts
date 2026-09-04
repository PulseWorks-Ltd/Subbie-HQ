import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { downloadFromS3 } from "@/lib/s3";
import { renderPdfPagesToImages, UnreadablePdfError } from "@/lib/pdf-text-extraction";
import { extractDayWorksSheetSummariesFromImages } from "@/lib/grok";
import { AiSpendCapExceededError } from "@/lib/ai-usage";
import type { DraftSheetRecord } from "@/lib/day-works-sheet-extraction-types";

async function moduleForItem(projectId: string, itemId: string) {
  const item = await prisma.variationItem.findFirst({ where: { id: itemId, projectId }, select: { type: true } });
  if (!item) return null;
  return item.type === "variation" ? ("variations" as const) : ("site_instructions" as const);
}

// No per-worker complexity here — unlike the previous version of this
// route, there's no date-fallback or rate-boundary-splitting logic
// needed, since a sheet summary doesn't need a resolved date to compute
// anything. Missing sheetNumber/teamLeaderCount/teamMemberCount just get
// a sensible default (sequential "Sheet N", 0) rather than blocking or
// guessing a real value.
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

    let images: { dataUrl: string }[];
    if (sheet.contentType === "application/pdf") {
      const pages = await renderPdfPagesToImages(buffer);
      images = pages.map((page) => ({ dataUrl: page.dataUrl }));
    } else if (sheet.contentType?.startsWith("image/")) {
      const base64 = Buffer.from(buffer).toString("base64");
      images = [{ dataUrl: `data:${sheet.contentType};base64,${base64}` }];
    } else {
      return NextResponse.json(
        { error: "This file type can't be read automatically. Please add a sheet summary manually." },
        { status: 422 }
      );
    }

    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { organisationId: true } });
    const rawSheets = await extractDayWorksSheetSummariesFromImages(images, {
      organisationId: project?.organisationId ?? null,
      userId,
      contextRef: sheetId
    });

    const draftRecords: DraftSheetRecord[] = rawSheets.map((raw, index) => ({
      sheetNumber: raw.sheetNumber?.trim() || `Sheet ${index + 1}`,
      teamLeaderCount: raw.teamLeaderCount ?? 0,
      teamMemberCount: raw.teamMemberCount ?? 0,
      totalHours: raw.totalHours,
      date: raw.date,
      startTime: raw.startTime,
      finishTime: raw.finishTime,
      task: raw.task,
      notes: raw.notes,
      weather: raw.weather,
      location: raw.location,
      confidence: raw.confidence
    }));

    return NextResponse.json({ records: draftRecords });
  } catch (error) {
    if (error instanceof AiSpendCapExceededError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    const message =
      error instanceof UnreadablePdfError
        ? "This file's pages couldn't be read automatically. Please add a sheet summary manually."
        : "Could not read this document automatically. You can still add a sheet summary manually.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
