import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrganisationMembership } from "@/lib/organisation";
import { SettingsView } from "@/components/settings/settings-view";

export default async function SettingsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const session = await auth();
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { organisationId: true, riskLevel: true, invoiceModeEnabled: true }
  });
  const membership = session?.user?.id ? await getOrganisationMembership(session.user.id) : null;

  const canAccess =
    !project?.organisationId || (membership?.isAdmin && membership.organisationId === project.organisationId);
  if (!project || !canAccess) {
    redirect(`/projects/${projectId}`);
  }

  const contractTerms = await prisma.contractTerms.findUnique({ where: { projectId } });

  return (
    <SettingsView
      projectId={projectId}
      riskLevel={project.riskLevel}
      invoiceModeEnabled={project.invoiceModeEnabled}
      contractTerms={contractTerms}
    />
  );
}
