import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, requireUserId } from "@/lib/auth";

// Read-only load for the review screen — gated by plain project access
// only (per-item module checks happen at file time, since project-level
// access to Variations/Site Instructions is never implied just by being
// able to see this project at all).
export async function GET(request: Request, context: { params: { projectId: string; extractionId: string } }) {
  const userId = await requireUserId(request);
  const { projectId, extractionId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const extraction = await prisma.inboundDayWorksExtraction.findFirst({
    where: { id: extractionId, projectId },
    include: {
      inboundEmail: { select: { subject: true, sender: true, receivedAt: true } },
      sheets: {
        include: { inboundEmailAttachment: { select: { fileName: true } } },
        orderBy: [{ inboundEmailAttachmentId: "asc" }, { sheetIndexInAttachment: "asc" }]
      }
    }
  });
  if (!extraction) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const candidateVariationItems = await prisma.variationItem.findMany({
    where: { projectId },
    select: { id: true, reference: true, title: true, closedAt: true },
    orderBy: { reference: "asc" }
  });

  return NextResponse.json({ extraction, candidateVariationItems });
}
