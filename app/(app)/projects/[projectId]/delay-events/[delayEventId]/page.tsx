import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/auth";
import { DelayEventDetailView } from "@/components/delay-events/delay-event-detail-view";

export default async function DelayEventDetailPage({
  params
}: {
  params: Promise<{ projectId: string; delayEventId: string }>;
}) {
  const { projectId, delayEventId } = await params;

  const session = await auth();
  const userId = session?.user?.id;
  const canAccess = userId ? await requireModuleAccess(projectId, userId, "delay_events") : false;
  if (!canAccess) {
    redirect(`/projects/${projectId}`);
  }

  const [delayEvent, project] = await Promise.all([
    prisma.delayEvent.findFirst({
      where: { id: delayEventId, projectId },
      include: {
        variationItem: { select: { id: true, reference: true, title: true } },
        externalActions: { orderBy: { sentAt: "desc" } }
      }
    }),
    prisma.project.findUnique({ where: { id: projectId }, select: { mainContractorId: true } })
  ]);
  if (!delayEvent) notFound();

  const contacts = project?.mainContractorId
    ? await prisma.mainContractorContact.findMany({
        where: { mainContractorId: project.mainContractorId },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: "asc" }
      })
    : [];

  return <DelayEventDetailView projectId={projectId} delayEvent={delayEvent} contacts={contacts} />;
}
