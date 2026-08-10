import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { uploadToS3 } from "@/lib/s3";
import { renderPdfPagesToImages, UnreadablePdfError } from "@/lib/pdf-text-extraction";
import {
  classifyAndExtractDayWorksDocument,
  type ClassifiedDocumentType,
  type ExtractedDayWorksSheetSummary,
  type ExtractedLineItem
} from "@/lib/grok";
import { AiSpendCapExceededError } from "@/lib/ai-usage";
import type { DraftSheetRecord } from "@/app/api/projects/[projectId]/variation-items/[itemId]/day-works-sheets/[sheetId]/sheet-records/extract/route";

async function moduleForItem(projectId: string, itemId: string) {
  const item = await prisma.variationItem.findFirst({ where: { id: itemId, projectId }, select: { type: true } });
  if (!item) return null;
  return item.type === "variation" ? ("variations" as const) : ("site_instructions" as const);
}

export type ClassifiedFileResult = {
  fileName: string;
  storageKey: string;
  contentType: string;
  documentType: ClassifiedDocumentType;
  classificationConfidence: number;
  dayWorksSheets: DraftSheetRecord[];
  materialsLineItems: ExtractedLineItem[];
  plantLineItems: ExtractedLineItem[];
  error: string | null;
};

// Same normalization the original per-sheet extract route applies to its
// own ExtractedDayWorksSheetSummary[] result (sheetNumber/crew counts get
// sensible defaults rather than staying null) — reused here so a file
// that resolves to day_works_sheet through this unified call behaves
// identically to the original single-purpose flow's draft rows.
function toDraftSheetRecords(sheets: ExtractedDayWorksSheetSummary[]): DraftSheetRecord[] {
  return sheets.map((raw, index) => ({
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
}

// Multi-file upload + classify (Task 3.1/4.1) — every selected file is
// uploaded to S3 immediately (permanent, real evidence, same "+Upload
// happens up front" precedent as the original single-sheet flow), then
// run through ONE vision call each that both classifies and extracts.
// Nothing is written to DayWorksSheet/DayWorksMaterial/DayWorksPlant
// here — that only happens from the unified review dialog's explicit
// Save action (see .../labour-plant-material/save/route.ts, Task 6.2).
// One file failing (unreadable PDF, spend cap hit, etc.) doesn't fail the
// whole batch — each file's own outcome (including an error) is reported
// independently so the rest of the batch still comes back usable.
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

  const formData = await request.formData();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { organisationId: true } });

  const results: ClassifiedFileResult[] = [];

  for (const file of files) {
    const buffer = new Uint8Array(await file.arrayBuffer());
    const contentType = file.type || "application/octet-stream";
    const uploadKey = `projects/${projectId}/variation-items/${itemId}/labour-plant-material/${Date.now()}-${file.name}`;
    const { storageKey } = await uploadToS3({ key: uploadKey, body: buffer, contentType });

    const base: Omit<ClassifiedFileResult, "documentType" | "classificationConfidence" | "dayWorksSheets" | "materialsLineItems" | "plantLineItems" | "error"> = {
      fileName: file.name,
      storageKey,
      contentType
    };

    try {
      let images: { dataUrl: string }[];
      if (contentType === "application/pdf") {
        const pages = await renderPdfPagesToImages(buffer);
        images = pages.map((page) => ({ dataUrl: page.dataUrl }));
      } else if (contentType.startsWith("image/")) {
        const base64 = Buffer.from(buffer).toString("base64");
        images = [{ dataUrl: `data:${contentType};base64,${base64}` }];
      } else {
        results.push({
          ...base,
          documentType: "unknown",
          classificationConfidence: 0,
          dayWorksSheets: [],
          materialsLineItems: [],
          plantLineItems: [],
          error: "This file type can't be read automatically — assign a type below and enter its details manually."
        });
        continue;
      }

      const extracted = await classifyAndExtractDayWorksDocument(images, {
        organisationId: project?.organisationId ?? null,
        userId,
        contextRef: itemId
      });

      results.push({
        ...base,
        documentType: extracted.documentType,
        classificationConfidence: extracted.classificationConfidence,
        dayWorksSheets: toDraftSheetRecords(extracted.dayWorksSheets),
        materialsLineItems: extracted.materialsLineItems,
        plantLineItems: extracted.plantLineItems,
        error: null
      });
    } catch (error) {
      const message =
        error instanceof AiSpendCapExceededError
          ? error.message
          : error instanceof UnreadablePdfError
            ? "This file's pages couldn't be read automatically — assign a type below and enter its details manually."
            : "Could not read this document automatically — assign a type below and enter its details manually.";
      results.push({
        ...base,
        documentType: "unknown",
        classificationConfidence: 0,
        dayWorksSheets: [],
        materialsLineItems: [],
        plantLineItems: [],
        error: message
      });
    }
  }

  return NextResponse.json({ results });
}
