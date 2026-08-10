import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/auth";
import { markProjectUpdatesRead } from "@/lib/updates-feed";
import { UpdatesView } from "@/components/updates/updates-view";

export default async function UpdatesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    redirect(`/projects/${projectId}`);
  }
  const canAccess = await requireModuleAccess(projectId, userId, "updates");
  if (!canAccess) {
    redirect(`/projects/${projectId}`);
  }

  // Loading this page IS viewing every Update on it in full (see
  // lib/updates-feed.ts's markProjectUpdatesRead) — covers both a direct
  // visit and navigating here from the Dashboard's Updates section.
  await markProjectUpdatesRead(projectId, userId);

  const canSeeVariations = userId ? await requireModuleAccess(projectId, userId, "variations") : false;
  const canSeeSiteInstructions = userId ? await requireModuleAccess(projectId, userId, "site_instructions") : false;
  const visibleTypes: ("variation" | "site_instruction")[] = [
    ...(canSeeVariations ? (["variation"] as const) : []),
    ...(canSeeSiteInstructions ? (["site_instruction"] as const) : [])
  ];

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { mainContractorId: true } });

  const [updates, taggableItems, contacts, contractTerms] = await Promise.all([
    prisma.update.findMany({
      where: { projectId, parentId: null },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, email: true } },
        variationItem: { select: { id: true, reference: true, title: true } },
        attachments: true,
        replies: {
          include: {
            author: { select: { id: true, firstName: true, lastName: true, email: true } },
            attachments: true
          },
          orderBy: { createdAt: "asc" }
        }
      },
      orderBy: { createdAt: "desc" }
    }),
    visibleTypes.length > 0
      ? prisma.variationItem.findMany({
          where: { projectId, type: { in: visibleTypes }, status: { not: "complete" } },
          orderBy: { createdAt: "desc" }
        })
      : Promise.resolve([]),
    project?.mainContractorId
      ? prisma.mainContractorContact.findMany({
          where: { mainContractorId: project.mainContractorId },
          select: { id: true, name: true, email: true, role: true },
          orderBy: { name: "asc" }
        })
      : Promise.resolve([]),
    prisma.contractTerms.findUnique({ where: { projectId } })
  ]);

  // Same "Use as Day Works Sheet" pre-fill as the item's own "+Upload"
  // flow (LabourPlantMaterialSection) — ContractTerms is one row per
  // project, so the same value applies to whichever item ends up selected.
  const defaultRatePerHour =
    contractTerms?.dayWorksRateNormal != null ? String(Number(contractTerms.dayWorksRateNormal)) : "";

  return (
    <UpdatesView
      projectId={projectId}
      updates={updates}
      taggableItems={taggableItems}
      contacts={contacts}
      defaultRatePerHour={defaultRatePerHour}
    />
  );
}
