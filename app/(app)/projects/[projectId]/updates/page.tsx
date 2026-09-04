import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/auth";
import { markProjectUpdatesRead } from "@/lib/updates-feed";
import { getTaggableContractItems } from "@/lib/contract-schedule";
import { UpdatesView } from "@/components/updates/updates-view";
import { UPDATE_CATEGORIES } from "@/lib/update-category";

export default async function UpdatesPage({
  params,
  searchParams
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ q?: string; from?: string; to?: string; category?: string }>;
}) {
  const { projectId } = await params;
  const { q, from, to, category } = await searchParams;
  const trimmedQ = q?.trim();
  const fromDate = from ? new Date(`${from}T00:00:00`) : undefined;
  const toDate = to ? new Date(`${to}T23:59:59.999`) : undefined;
  const validCategory = category && (UPDATE_CATEGORIES as string[]).includes(category) ? category : undefined;

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

  const [updates, taggableItems, contacts, contractTerms, contractItems] = await Promise.all([
    prisma.update.findMany({
      where: {
        projectId,
        parentId: null,
        ...(fromDate || toDate
          ? { createdAt: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } }
          : {}),
        ...(validCategory ? { category: validCategory as (typeof UPDATE_CATEGORIES)[number] } : {}),
        ...(trimmedQ
          ? {
              OR: [
                { body: { contains: trimmedQ, mode: "insensitive" as const } },
                { externalSubject: { contains: trimmedQ, mode: "insensitive" as const } },
                { externalBody: { contains: trimmedQ, mode: "insensitive" as const } },
                { variationItem: { reference: { contains: trimmedQ, mode: "insensitive" as const } } },
                {
                  replies: {
                    some: {
                      OR: [
                        { body: { contains: trimmedQ, mode: "insensitive" as const } },
                        { externalSubject: { contains: trimmedQ, mode: "insensitive" as const } },
                        { externalBody: { contains: trimmedQ, mode: "insensitive" as const } }
                      ]
                    }
                  }
                }
              ]
            }
          : {})
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, email: true } },
        variationItem: { select: { id: true, reference: true, title: true } },
        qaRecord: { select: { id: true, stage: true } },
        attachments: true,
        contractItemLinks: { select: { contractItemId: true } },
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
          where: { projectId, type: { in: visibleTypes }, status: { not: "complete" }, closedAt: null },
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
    prisma.contractTerms.findUnique({ where: { projectId } }),
    getTaggableContractItems(projectId)
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
      contractItems={contractItems}
      initialQuery={q ?? ""}
      initialFrom={from ?? ""}
      initialTo={to ?? ""}
      initialCategory={validCategory ?? ""}
    />
  );
}
