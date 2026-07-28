import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/auth";
import { ContractView } from "@/components/contract/contract-view";

export default async function ContractPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const session = await auth();
  const canAccess = session?.user?.id ? await requireModuleAccess(projectId, session.user.id, "contract") : false;
  if (!canAccess) {
    redirect(`/projects/${projectId}`);
  }

  const documents = await prisma.contractDocument.findMany({
    where: { projectId },
    include: {
      clauses: { orderBy: { createdAt: "desc" } },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { deviations: { orderBy: { priorityScore: "desc" } } }
      }
    },
    orderBy: { uploadedAt: "desc" }
  });

  return <ContractView projectId={projectId} documents={documents} />;
}
