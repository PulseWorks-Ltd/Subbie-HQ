import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/auth";
import { getActiveSheet, listSheetsForProject } from "@/lib/hours-on-site";
import { HoursOnSiteProjectView } from "@/components/mobile/hours-on-site-project-view";

export default async function HoursOnSiteProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const session = await auth();
  const userId = session!.user.id;

  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) notFound();

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, name: true } });
  if (!project) notFound();

  const [activeSheet, sheets, openSiteInstructions] = await Promise.all([
    getActiveSheet(projectId, userId),
    listSheetsForProject(projectId),
    prisma.variationItem.findMany({
      where: { projectId, type: "site_instruction", status: { not: "complete" }, closedAt: null },
      select: { id: true, reference: true, title: true },
      orderBy: { createdAt: "desc" }
    })
  ]);

  return (
    <HoursOnSiteProjectView
      projectId={projectId}
      projectName={project.name}
      activeSheet={activeSheet ? { id: activeSheet.id, startedAt: activeSheet.startedAt.toISOString() } : null}
      sheets={sheets.map((sheet) => ({
        id: sheet.id,
        startedAt: sheet.startedAt.toISOString(),
        finishedAt: sheet.finishedAt ? sheet.finishedAt.toISOString() : null,
        totalHours: sheet.totalHours != null ? Number(sheet.totalHours) : null,
        variationItem: sheet.variationItem,
        comments: sheet.comments,
        workerCount: sheet.workers.length
      }))}
      openSiteInstructions={openSiteInstructions}
    />
  );
}
