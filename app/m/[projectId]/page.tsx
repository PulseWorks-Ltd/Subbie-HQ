import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess } from "@/lib/auth";
import { MobileUpdatesView } from "@/components/mobile/mobile-updates-view";
import { UPDATE_CATEGORIES } from "@/lib/update-category";

export default async function MobileProjectUpdatesPage({
  params,
  searchParams
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ update?: string; q?: string; from?: string; to?: string; category?: string }>;
}) {
  const session = await auth();
  const { projectId } = await params;
  const { update: highlightUpdateId, q, from, to, category } = await searchParams;
  const trimmedQ = q?.trim();
  const fromDate = from ? new Date(`${from}T00:00:00`) : undefined;
  const toDate = to ? new Date(`${to}T23:59:59.999`) : undefined;
  const validCategory = category && (UPDATE_CATEGORIES as string[]).includes(category) ? category : undefined;

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

  const [updates, taggableItems, contacts] = await Promise.all([
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
    project.mainContractorId
      ? prisma.mainContractorContact.findMany({
          where: { mainContractorId: project.mainContractorId },
          select: { id: true, name: true, email: true, role: true },
          orderBy: { name: "asc" }
        })
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
      <MobileUpdatesView
        projectId={projectId}
        updates={updates}
        taggableItems={taggableItems}
        contacts={contacts}
        highlightUpdateId={highlightUpdateId}
        initialQuery={q ?? ""}
        initialFrom={from ?? ""}
        initialTo={to ?? ""}
        initialCategory={validCategory ?? ""}
      />
    </div>
  );
}
