import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/auth";
import { TasksView } from "@/components/tasks/tasks-view";

export default async function TasksPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const session = await auth();
  const userId = session?.user?.id;
  const canAccess = userId ? await requireProjectAccess(projectId, userId) : false;
  if (!canAccess) {
    redirect(`/projects/${projectId}`);
  }

  const [tasks, taggableItems] = await Promise.all([
    prisma.task.findMany({
      where: { projectId },
      include: { variationItem: { select: { id: true, reference: true, title: true } } },
      orderBy: { createdAt: "desc" }
    }),
    prisma.variationItem.findMany({
      where: { projectId, closedAt: null },
      select: { id: true, reference: true, title: true },
      orderBy: { createdAt: "desc" }
    })
  ]);

  return <TasksView projectId={projectId} tasks={tasks} taggableItems={taggableItems} />;
}
