import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/auth";
import { UpdatesView } from "@/components/updates/updates-view";

export default async function UpdatesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const session = await auth();
  const userId = session?.user?.id;
  const canAccess = userId ? await requireModuleAccess(projectId, userId, "updates") : false;
  if (!canAccess) {
    redirect(`/projects/${projectId}`);
  }
  const canManageSiteInstructions = userId ? await requireModuleAccess(projectId, userId, "site_instructions") : false;

  const [updates, siteInstructions] = await Promise.all([
    prisma.update.findMany({
      where: { projectId, parentId: null },
      include: {
        author: { select: { id: true, name: true, email: true } },
        siteInstruction: { select: { id: true, reference: true, title: true } },
        attachments: true,
        replies: {
          include: {
            author: { select: { id: true, name: true, email: true } },
            attachments: true
          },
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

  return (
    <UpdatesView
      projectId={projectId}
      updates={updates}
      siteInstructions={siteInstructions}
      canManageSiteInstructions={canManageSiteInstructions}
    />
  );
}
