import { prisma } from "@/lib/prisma";
import { HealthSafetyView } from "@/components/health-safety/health-safety-view";

export default async function HealthSafetyPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const safetyDocuments = await prisma.safetyDocument.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" }
  });

  return <HealthSafetyView projectId={projectId} safetyDocuments={safetyDocuments} />;
}
