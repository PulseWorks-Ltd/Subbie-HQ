import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, requireUserId } from "@/lib/auth";
import { updateDayWorksExtractionSheet } from "@/lib/inbound-day-works";

const bodySchema = z.object({
  sheetNumber: z.string().nullable().optional(),
  teamLeaderCount: z.number().int().min(0).nullable().optional(),
  teamMemberCount: z.number().int().min(0).nullable().optional(),
  totalHours: z.number().min(0).nullable().optional(),
  ratePerHour: z.number().min(0).nullable().optional(),
  date: z.string().nullable().optional(),
  startTime: z.string().nullable().optional(),
  finishTime: z.string().nullable().optional(),
  task: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  weather: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  matchedVariationItemId: z.string().nullable().optional(),
  userAction: z.enum(["pending", "match_existing", "create_new", "ignore"]).optional(),
  newItemReference: z.string().nullable().optional(),
  newItemTitle: z.string().nullable().optional()
});

// A reviewer edit on the review screen — any summary field, a manual match
// override (mirrors Payment Claim Import's own per-row override pattern),
// or an explicit action selection. Only ever allowed on a still-unfiled
// sheet (enforced inside updateDayWorksExtractionSheet).
export async function PATCH(
  request: Request,
  context: { params: { projectId: string; extractionId: string; sheetId: string } }
) {
  const userId = await requireUserId(request);
  const { projectId, extractionId, sheetId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sheet = await prisma.inboundDayWorksExtractionSheet.findFirst({
    where: { id: sheetId, inboundDayWorksExtractionId: extractionId, extraction: { projectId } }
  });
  if (!sheet) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (parsed.data.matchedVariationItemId) {
    const target = await prisma.variationItem.findFirst({ where: { id: parsed.data.matchedVariationItemId, projectId } });
    if (!target) {
      return NextResponse.json({ error: "Variation/Site Instruction not found on this project." }, { status: 400 });
    }
  }

  try {
    await updateDayWorksExtractionSheet(sheetId, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save this change." }, { status: 409 });
  }
}
