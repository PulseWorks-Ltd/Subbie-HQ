import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/auth";
import { ScopeView } from "@/components/scope/scope-view";

export default async function ScopePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const session = await auth();
  const canAccess = session?.user?.id ? await requireModuleAccess(projectId, session.user.id, "scope") : false;
  if (!canAccess) {
    redirect(`/projects/${projectId}`);
  }

  const [items, documents] = await Promise.all([
    prisma.scopeItem.findMany({
      where: { projectId },
      include: { sourceDocument: true, sourceClause: true },
      orderBy: { createdAt: "desc" }
    }),
    prisma.contractDocument.findMany({
      where: { projectId },
      include: { clauses: true },
      orderBy: { uploadedAt: "desc" }
    })
  ]);

  return <ScopeView projectId={projectId} items={items} documents={documents} />;
}
