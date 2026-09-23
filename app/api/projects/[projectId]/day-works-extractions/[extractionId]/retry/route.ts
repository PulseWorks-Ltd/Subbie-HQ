import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, requireUserId } from "@/lib/auth";
import { retryDayWorksExtraction } from "@/lib/inbound-day-works";

// Awaited (unlike the initial fire-and-forget kick-off) — this is a
// deliberate user action, same convention as the Incoming Emails
// "reclassify" action for a failed classification.
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

  await retryDayWorksExtraction(extractionId);
  const updated = await prisma.inboundDayWorksExtraction.findUnique({ where: { id: extractionId } });
  if (updated?.status === "failed") {
    return NextResponse.json({ error: updated.extractionError ?? "Extraction failed." }, { status: 422 });
  }

  return NextResponse.json({ ok: true });
}
