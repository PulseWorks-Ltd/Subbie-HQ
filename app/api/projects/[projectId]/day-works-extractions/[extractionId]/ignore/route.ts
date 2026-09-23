import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, requireUserId } from "@/lib/auth";
import { ignoreDayWorksExtractionSheets } from "@/lib/inbound-day-works";

const bodySchema = z.object({ sheetIds: z.array(z.string()).min(1) });

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

  await ignoreDayWorksExtractionSheets(extractionId, parsed.data.sheetIds);
  return NextResponse.json({ ok: true });
}
