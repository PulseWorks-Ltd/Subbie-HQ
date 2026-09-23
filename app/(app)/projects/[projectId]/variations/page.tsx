import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/auth";
import { getUnclaimedVariationValue } from "@/lib/payment-claim";
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

  const [variationItems, openSiteInstructions, allProjectVariations] = await Promise.all([
    prisma.variationItem.findMany({
      where: { projectId, type: { in: visibleTypes } },
      include: { claimAllocations: { select: { amount: true } } },
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
      : Promise.resolve([]),
    // Project-wide (not visibleTypes/closed-filtered) so "Variation N" is a
    // stable identity — it never renumbers because of the closed-items
    // toggle or because a particular viewer's module access hides some rows.
    prisma.variationItem.findMany({
      where: { projectId, variationCreatedAt: { not: null } },
      select: { id: true, variationCreatedAt: true },
      orderBy: { variationCreatedAt: "asc" }
    })
  ]);

  const unclaimedValues = Object.fromEntries(
    variationItems.map((item) => [item.id, getUnclaimedVariationValue(item)])
  );
  const variationNumbers = Object.fromEntries(
    allProjectVariations.map((item, index) => [item.id, index + 1])
  );

  return (
    <VariationsView
      projectId={projectId}
      items={variationItems}
      unclaimedValues={unclaimedValues}
      variationNumbers={variationNumbers}
      openSiteInstructions={openSiteInstructions}
      canCreateVariation={canSeeVariations}
      canCreateSiteInstruction={canSeeSiteInstructions}
    />
  );
}
