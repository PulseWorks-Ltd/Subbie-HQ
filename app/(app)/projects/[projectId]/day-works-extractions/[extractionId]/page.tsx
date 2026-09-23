import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/auth";
import { DayWorksExtractionReviewView } from "@/components/day-works/day-works-extraction-review-view";

// Gated by plain project access only (not a specific module) — the review
// screen itself is read-only until a File/Ignore action is taken, and
// THOSE are re-checked per distinct target module in the file API route
// (org-level Incoming Emails access never implies project-level
// Variations/Site Instructions access). See lib/inbound-day-works.ts.
export default async function DayWorksExtractionReviewPage({
  params
}: {
  params: Promise<{ projectId: string; extractionId: string }>;
}) {
  const { projectId, extractionId } = await params;

  const session = await auth();
  const userId = session?.user?.id;
  const canAccess = userId ? await requireProjectAccess(projectId, userId) : false;
  if (!canAccess) {
    redirect(`/projects/${projectId}`);
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
    notFound();
  }

  const candidateVariationItems = await prisma.variationItem.findMany({
    where: { projectId },
    select: { id: true, reference: true, title: true, closedAt: true },
    orderBy: { reference: "asc" }
  });

  return (
    <DayWorksExtractionReviewView
      projectId={projectId}
      extraction={{
        id: extraction.id,
        status: extraction.status,
        extractionError: extraction.extractionError,
        emailSubject: extraction.inboundEmail.subject,
        emailSender: extraction.inboundEmail.sender,
        sheets: extraction.sheets.map((sheet) => ({
          id: sheet.id,
          attachmentFileName: sheet.inboundEmailAttachment.fileName,
          sheetNumber: sheet.sheetNumber,
          teamLeaderCount: sheet.teamLeaderCount,
          teamMemberCount: sheet.teamMemberCount,
          totalHours: sheet.totalHours != null ? Number(sheet.totalHours) : null,
          ratePerHour: sheet.ratePerHour != null ? Number(sheet.ratePerHour) : null,
          date: sheet.date ? sheet.date.toISOString().slice(0, 10) : null,
          startTime: sheet.startTime,
          finishTime: sheet.finishTime,
          task: sheet.task,
          notes: sheet.notes,
          weather: sheet.weather,
          location: sheet.location,
          confidence: sheet.confidence,
          extractedSiReference: sheet.extractedSiReference,
          matchStatus: sheet.matchStatus,
          matchedVariationItemId: sheet.matchedVariationItemId,
          matchReason: sheet.matchReason,
          userAction: sheet.userAction,
          newItemReference: sheet.newItemReference,
          newItemTitle: sheet.newItemTitle,
          filedAt: sheet.filedAt ? sheet.filedAt.toISOString() : null
        }))
      }}
      candidateVariationItems={candidateVariationItems.map((item) => ({
        id: item.id,
        reference: item.reference,
        title: item.title,
        closed: item.closedAt != null
      }))}
    />
  );
}
