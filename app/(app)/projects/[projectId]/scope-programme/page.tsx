import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/auth";
import { ScopeProgrammeView, type ScopeProgrammeTab } from "@/components/scope-programme/scope-programme-view";

export default async function ScopeProgrammePage({
  params,
  searchParams
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { projectId } = await params;
  const { tab } = await searchParams;

  const session = await auth();
  const userId = session?.user?.id;
  const canSeeScope = userId ? await requireModuleAccess(projectId, userId, "scope") : false;
  const canSeeProgramme = userId ? await requireModuleAccess(projectId, userId, "programme") : false;
  if (!canSeeScope && !canSeeProgramme) {
    redirect(`/projects/${projectId}`);
  }

  const [scopeItems, scopeDocuments, programmeItems, programmeDocuments, project] = await Promise.all([
    canSeeScope
      ? prisma.scopeItem.findMany({
          where: { projectId },
          include: { sourceDocument: true, sourceClause: true },
          orderBy: { createdAt: "desc" }
        })
      : Promise.resolve([]),
    canSeeScope
      ? prisma.contractDocument.findMany({ where: { projectId }, include: { clauses: true }, orderBy: { uploadedAt: "desc" } })
      : Promise.resolve([]),
    canSeeProgramme
      ? prisma.programmeItem.findMany({ where: { projectId }, include: { sourceDocument: true }, orderBy: { createdAt: "desc" } })
      : Promise.resolve([]),
    canSeeProgramme
      ? prisma.contractDocument.findMany({
          where: { projectId, documentType: "programme" },
          orderBy: { uploadedAt: "desc" }
        })
      : Promise.resolve([]),
    canSeeProgramme ? prisma.project.findUnique({ where: { id: projectId }, select: { tradeReference: true } }) : Promise.resolve(null)
  ]);

  const initialTab: ScopeProgrammeTab = tab === "programme" && canSeeProgramme ? "programme" : canSeeScope ? "scope" : "programme";

  return (
    <ScopeProgrammeView
      projectId={projectId}
      initialTab={initialTab}
      canSeeScope={canSeeScope}
      canSeeProgramme={canSeeProgramme}
      scopeItems={scopeItems}
      scopeDocuments={scopeDocuments}
      programmeItems={programmeItems}
      programmeActiveDocument={programmeDocuments[0] ?? null}
      initialTradeReference={project?.tradeReference ?? ""}
    />
  );
}
