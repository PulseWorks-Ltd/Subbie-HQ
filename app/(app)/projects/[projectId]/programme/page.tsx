import { prisma } from "@/lib/prisma";
import { ProgrammeView } from "@/components/programme/programme-view";

export default async function ProgrammePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const [items, programmeDocuments, project] = await Promise.all([
    prisma.programmeItem.findMany({
      where: { projectId },
      include: { sourceDocument: true },
      orderBy: { createdAt: "desc" }
    }),
    prisma.contractDocument.findMany({
      where: { projectId, documentType: "programme" },
      orderBy: { uploadedAt: "desc" }
    }),
    prisma.project.findUnique({ where: { id: projectId }, select: { tradeReference: true } })
  ]);

  return (
    <ProgrammeView
      projectId={projectId}
      items={items}
      activeDocument={programmeDocuments[0] ?? null}
      initialTradeReference={project?.tradeReference ?? ""}
    />
  );
}
