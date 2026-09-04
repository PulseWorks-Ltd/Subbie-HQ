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

  const [qaRecords, taggableItems, selectableRecordRows, qaDocuments, project] = await Promise.all([
    prisma.qARecord.findMany({
      where: { projectId },
      include: { variationItem: { select: { id: true, reference: true, title: true } }, attachments: true },
      orderBy: { date: "desc" }
    }),
    taggableTypes.length > 0
      ? prisma.variationItem.findMany({
          where: { projectId, type: { in: taggableTypes }, status: { not: "complete" }, closedAt: null },
          orderBy: { createdAt: "desc" }
        })
      : Promise.resolve([]),
    // "Generate QA Document" — not yet included in any previous document
    // (see QaDocumentRecord's own schema comment: this is a derived state,
    // not a stored flag).
    prisma.qARecord.findMany({
      where: { projectId, documentLinks: { none: {} } },
      select: { id: true, stage: true, notes: true, date: true, attachments: { select: { contentType: true } } },
      orderBy: { date: "desc" }
    }),
    prisma.qaDocument.findMany({
      where: { projectId },
      include: {
        generatedByUser: { select: { firstName: true, lastName: true, email: true } },
        records: { orderBy: { sortOrder: "asc" }, include: { qaRecord: { select: { id: true, stage: true, date: true } } } }
      },
      orderBy: { docNumber: "desc" }
    }),
    prisma.project.findUnique({ where: { id: projectId }, select: { jobNumber: true, mainContractorId: true } })
  ]);

  const contacts = project?.mainContractorId
    ? await prisma.mainContractorContact.findMany({
        where: { mainContractorId: project.mainContractorId },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: "asc" }
      })
    : [];

  const selectableRecords = selectableRecordRows.map((record) => ({
    id: record.id,
    stage: record.stage,
    notes: record.notes,
    date: record.date.toISOString(),
    photoCount: record.attachments.filter((a) => a.contentType?.startsWith("image/")).length
  }));

  return (
    <QualityAssuranceView
      projectId={projectId}
      qaRecords={qaRecords}
      taggableItems={taggableItems}
      selectableRecords={selectableRecords}
      qaDocuments={qaDocuments.map((doc) => ({
        ...doc,
        generatedAt: doc.generatedAt.toISOString(),
        records: doc.records.map((link) => ({
          qaRecord: { ...link.qaRecord, date: link.qaRecord.date.toISOString() }
        }))
      }))}
      contacts={contacts}
      defaultContractReference={project?.jobNumber ?? ""}
    />
  );
}
