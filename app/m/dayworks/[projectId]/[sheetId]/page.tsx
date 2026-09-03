import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/auth";
import { getSheetWithDetail } from "@/lib/hours-on-site";
import { getSignedDownloadUrl } from "@/lib/s3";
import { HoursOnSiteSheetView } from "@/components/mobile/hours-on-site-sheet-view";

export default async function HoursOnSiteSheetPage({
  params
}: {
  params: Promise<{ projectId: string; sheetId: string }>;
}) {
  const { projectId, sheetId } = await params;
  const session = await auth();
  const userId = session!.user.id;

  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) notFound();

  const [sheet, project] = await Promise.all([
    getSheetWithDetail(sheetId),
    prisma.project.findUnique({ where: { id: projectId }, select: { mainContractorId: true } })
  ]);
  if (!sheet || sheet.projectId !== projectId) notFound();

  const contacts = project?.mainContractorId
    ? await prisma.mainContractorContact.findMany({
        where: { mainContractorId: project.mainContractorId },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: "asc" }
      })
    : [];

  const signatureImageUrl = sheet.signatureImageStorageKey
    ? await getSignedDownloadUrl(sheet.signatureImageStorageKey, 300)
    : null;

  return (
    <HoursOnSiteSheetView
      projectId={projectId}
      contacts={contacts}
      sheet={{
        id: sheet.id,
        dayWorksSheetNumber: sheet.dayWorksSheetNumber,
        projectName: sheet.project.name,
        variationItem: sheet.variationItem,
        comments: sheet.comments,
        startedAt: sheet.startedAt.toISOString(),
        finishedAt: sheet.finishedAt ? sheet.finishedAt.toISOString() : null,
        totalHours: sheet.totalHours != null ? Number(sheet.totalHours) : null,
        workers: sheet.workers.map((w) => ({ id: w.worker.id, name: w.worker.name })),
        approvedAt: sheet.approvedAt ? sheet.approvedAt.toISOString() : null,
        approvedByName: sheet.approvedByName,
        signatureImageUrl
      }}
    />
  );
}
