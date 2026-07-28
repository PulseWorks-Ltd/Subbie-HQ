import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/auth";
import { HealthSafetyView } from "@/components/health-safety/health-safety-view";

export default async function HealthSafetyPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const session = await auth();
  const canAccess = session?.user?.id ? await requireModuleAccess(projectId, session.user.id, "health_safety") : false;
  if (!canAccess) {
    redirect(`/projects/${projectId}`);
  }

  const safetyDocuments = await prisma.safetyDocument.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" }
  });

  return <HealthSafetyView projectId={projectId} safetyDocuments={safetyDocuments} />;
}
