import { prisma } from "@/lib/prisma";
import { ContractView } from "@/components/contract/contract-view";

export default async function ContractPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const documents = await prisma.contractDocument.findMany({
    where: { projectId },
    include: { clauses: { orderBy: { createdAt: "desc" } } },
    orderBy: { uploadedAt: "desc" }
  });

  return <ContractView projectId={projectId} documents={documents} />;
}
