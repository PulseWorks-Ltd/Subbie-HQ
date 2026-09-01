import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/auth";
import { VariationsView } from "@/components/variations/variations-view";

export default async function VariationsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const session = await auth();
  const userId = session?.user?.id;
  const canSeeVariations = userId ? await requireModuleAccess(projectId, userId, "variations") : false;
  const canSeeSiteInstructions = userId ? await requireModuleAccess(projectId, userId, "site_instructions") : false;

  if (!canSeeVariations && !canSeeSiteInstructions) {
    redirect(`/projects/${projectId}`);
  }

  const visibleTypes: ("variation" | "site_instruction")[] = [
    ...(canSeeVariations ? (["variation"] as const) : []),
    ...(canSeeSiteInstructions ? (["site_instruction"] as const) : [])
  ];

  const [variationItems, openSiteInstructions] = await Promise.all([
    prisma.variationItem.findMany({
      where: { projectId, type: { in: visibleTypes } },
      orderBy: { createdAt: "desc" }
    }),
    // For the "link to an existing Site Instruction" option when creating a
    // Variation — only ones that don't already carry a Variation identity,
    // and haven't been marked complete.
    canSeeVariations && canSeeSiteInstructions
      ? prisma.variationItem.findMany({
          where: { projectId, type: "site_instruction", variationCreatedAt: null, status: { not: "complete" }, closedAt: null },
          orderBy: { createdAt: "desc" }
        })
      : Promise.resolve([])
  ]);

  return (
    <VariationsView
      projectId={projectId}
      items={variationItems}
      openSiteInstructions={openSiteInstructions}
      canCreateVariation={canSeeVariations}
      canCreateSiteInstruction={canSeeSiteInstructions}
    />
  );
}
