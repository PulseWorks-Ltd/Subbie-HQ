import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { fileDayWorksExtractionSheets, getRequiredModulesForFiling } from "@/lib/inbound-day-works";

const bodySchema = z.object({
  sheetIds: z.array(z.string()).min(1),
  convertToVariationItemIds: z.array(z.string()).default([])
});

// Files a (possibly partial) selection of sheets — never an all-or-nothing
// confirm. Re-checks module access per distinct target TYPE this specific
// selection touches (Section: org-level Incoming Emails access never
// implies project-level Variations/Site Instructions access) — the same
// re-check discipline fileInboundEmail's own createVariationItem/
// createQaRecord branches already apply, just computed across a whole
// batch instead of one item.
export async function POST(request: Request, context: { params: { projectId: string; extractionId: string } }) {
  const userId = await requireUserId(request);
  const { projectId, extractionId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const extraction = await prisma.inboundDayWorksExtraction.findFirst({ where: { id: extractionId, projectId } });
  if (!extraction) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const requiredModules = await getRequiredModulesForFiling(extractionId, parsed.data.sheetIds, parsed.data.convertToVariationItemIds);
  for (const module_ of requiredModules) {
    const canAccess = await requireModuleAccess(projectId, userId, module_);
    if (!canAccess) {
      return NextResponse.json(
        { error: `You don't have access to file against ${module_ === "variations" ? "Variations" : "Site Instructions"} on this project.` },
        { status: 403 }
      );
    }
  }

  const result = await fileDayWorksExtractionSheets({
    extractionId,
    sheetIds: parsed.data.sheetIds,
    reviewerUserId: userId,
    convertToVariationItemIds: parsed.data.convertToVariationItemIds
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
