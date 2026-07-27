import { prisma } from "@/lib/prisma";
import { UpdatesView } from "@/components/updates/updates-view";

export default async function UpdatesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const [updates, siteInstructions] = await Promise.all([
    prisma.update.findMany({
      where: { projectId, parentId: null },
      include: {
        author: { select: { id: true, name: true, email: true } },
        siteInstruction: { select: { id: true, reference: true, title: true } },
        replies: {
          include: { author: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: "asc" }
        }
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.siteInstruction.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" }
    })
  ]);

  return <UpdatesView projectId={projectId} updates={updates} siteInstructions={siteInstructions} />;
}
