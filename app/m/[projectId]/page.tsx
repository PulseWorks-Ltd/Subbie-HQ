import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess } from "@/lib/auth";
import { MobileUpdatesView } from "@/components/mobile/mobile-updates-view";

export default async function MobileProjectUpdatesPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await auth();
  const { projectId } = await params;

  const hasAccess = await requireProjectAccess(projectId, session!.user.id);
  const canAccessUpdates = hasAccess && (await requireModuleAccess(projectId, session!.user.id, "updates"));
  if (!canAccessUpdates) {
    notFound();
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    notFound();
  }

  const canSeeVariations = await requireModuleAccess(projectId, session!.user.id, "variations");
  const canSeeSiteInstructions = await requireModuleAccess(projectId, session!.user.id, "site_instructions");
  const visibleTypes: ("variation" | "site_instruction")[] = [
    ...(canSeeVariations ? (["variation"] as const) : []),
    ...(canSeeSiteInstructions ? (["site_instruction"] as const) : [])
  ];

  const [updates, taggableItems] = await Promise.all([
    prisma.update.findMany({
      where: { projectId, parentId: null },
      include: {
        author: { select: { id: true, name: true, email: true } },
        variationItem: { select: { id: true, reference: true, title: true } },
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
    visibleTypes.length > 0
      ? prisma.variationItem.findMany({ where: { projectId, type: { in: visibleTypes } }, orderBy: { createdAt: "desc" } })
      : Promise.resolve([])
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <a href="/m" className="text-xs font-medium text-[#4c739a] dark:text-slate-400">
          &larr; Your Projects
        </a>
        <h1 className="text-lg font-bold">{project.name}</h1>
      </div>
      <MobileUpdatesView projectId={projectId} updates={updates} taggableItems={taggableItems} />
    </div>
  );
}
