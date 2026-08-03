import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/auth";
import { VariationDetailView } from "@/components/variations/variation-detail-view";

export default async function VariationItemPage({
  params
}: {
  params: Promise<{ projectId: string; itemId: string }>;
}) {
  const { projectId, itemId } = await params;

  const session = await auth();
  const userId = session?.user?.id;

  const item = await prisma.variationItem.findFirst({ where: { id: itemId, projectId } });
  if (!item) {
    notFound();
  }

  const module_ = item.type === "variation" ? "variations" : "site_instructions";
  const canAccess = userId ? await requireModuleAccess(projectId, userId, module_) : false;
  if (!canAccess) {
    redirect(`/projects/${projectId}/variations`);
  }

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { mainContractorId: true } });

  const [canSeeVariations, canSeeSiteInstructions] = userId
    ? await Promise.all([
        requireModuleAccess(projectId, userId, "variations"),
        requireModuleAccess(projectId, userId, "site_instructions")
      ])
    : [false, false];
  const taggableTypes: ("variation" | "site_instruction")[] = [
    ...(canSeeVariations ? (["variation"] as const) : []),
    ...(canSeeSiteInstructions ? (["site_instruction"] as const) : [])
  ];

  const [dayWorksSheets, photos, correspondence, updates, contacts, taggableItems, contractTerms, packages] = await Promise.all([
    prisma.dayWorksSheet.findMany({
      where: { variationItemId: itemId },
      orderBy: { createdAt: "desc" },
      include: {
        materials: { orderBy: { createdAt: "asc" } },
        plant: { orderBy: { createdAt: "asc" } },
        sheetRecords: { orderBy: { sortOrder: "asc" } }
      }
    }),
    prisma.variationPhoto.findMany({ where: { variationItemId: itemId }, orderBy: { createdAt: "desc" } }),
    prisma.correspondence.findMany({ where: { variationItemId: itemId }, orderBy: { createdAt: "desc" } }),
    prisma.update.findMany({
      where: { projectId, variationItemId: itemId, parentId: null },
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
    project?.mainContractorId
      ? prisma.mainContractorContact.findMany({
          where: { mainContractorId: project.mainContractorId },
          select: { id: true, name: true, email: true, role: true },
          orderBy: { name: "asc" }
        })
      : Promise.resolve([]),
    taggableTypes.length > 0
      ? prisma.variationItem.findMany({
          where: { projectId, type: { in: taggableTypes }, status: { not: "complete" } },
          orderBy: { createdAt: "desc" }
        })
      : Promise.resolve([]),
    prisma.contractTerms.findUnique({ where: { projectId } }),
    prisma.variationPackage.findMany({ where: { variationItemId: itemId }, orderBy: { createdAt: "desc" } })
  ]);

  return (
    <VariationDetailView
      projectId={projectId}
      item={item}
      dayWorksSheets={dayWorksSheets}
      photos={photos}
      correspondence={correspondence}
      updates={updates}
      contacts={contacts}
      taggableItems={taggableItems}
      contractTerms={contractTerms}
      packages={packages}
    />
  );
}
