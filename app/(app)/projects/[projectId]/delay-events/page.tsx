import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/auth";
import { DelayEventsListView } from "@/components/delay-events/delay-events-list-view";

export default async function DelayEventsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const session = await auth();
  const userId = session?.user?.id;
  const canAccess = userId ? await requireModuleAccess(projectId, userId, "delay_events") : false;
  if (!canAccess) {
    redirect(`/projects/${projectId}`);
  }

  const [delayEvents, taggableItems, project] = await Promise.all([
    prisma.delayEvent.findMany({
      where: { projectId },
      include: {
        variationItem: { select: { id: true, reference: true, title: true } },
        externalActions: { select: { status: true, responseChoice: true, respondedAt: true } }
      },
      orderBy: { startDate: "desc" }
    }),
    prisma.variationItem.findMany({
      where: { projectId, closedAt: null },
      select: { id: true, reference: true, title: true },
      orderBy: { createdAt: "desc" }
    }),
    prisma.project.findUnique({ where: { id: projectId }, select: { mainContractorId: true } })
  ]);

  // Same contact source as the detail page's own Send Notice dialog — the
  // Log Delay Event dialog can now optionally send the notice as part of
  // logging it (see DelayEventFormDialog), so it needs the same list.
  const contacts = project?.mainContractorId
    ? await prisma.mainContractorContact.findMany({
        where: { mainContractorId: project.mainContractorId },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: "asc" }
      })
    : [];

  return <DelayEventsListView projectId={projectId} delayEvents={delayEvents} taggableItems={taggableItems} contacts={contacts} />;
}
