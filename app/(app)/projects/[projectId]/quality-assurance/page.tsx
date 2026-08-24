import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/auth";
import { QualityAssuranceView } from "@/components/quality-assurance/quality-assurance-view";

export default async function QualityAssurancePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const session = await auth();
  const userId = session?.user?.id;
  const canAccess = userId ? await requireModuleAccess(projectId, userId, "quality_assurance") : false;
  if (!canAccess) {
    redirect(`/projects/${projectId}`);
  }

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

  const [qaRecords, taggableItems] = await Promise.all([
    prisma.qARecord.findMany({
      where: { projectId },
      include: { variationItem: { select: { id: true, reference: true, title: true } }, attachments: true },
      orderBy: { date: "desc" }
    }),
    taggableTypes.length > 0
      ? prisma.variationItem.findMany({
          where: { projectId, type: { in: taggableTypes }, status: { not: "complete" } },
          orderBy: { createdAt: "desc" }
        })
      : Promise.resolve([])
  ]);

  return <QualityAssuranceView projectId={projectId} qaRecords={qaRecords} taggableItems={taggableItems} />;
}
