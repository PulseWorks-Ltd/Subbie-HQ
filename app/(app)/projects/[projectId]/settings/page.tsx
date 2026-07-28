import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrganisationMembership } from "@/lib/organisation";
import { PlaceholderSection } from "@/components/placeholder-section";

export default async function SettingsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const session = await auth();
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { organisationId: true } });
  const membership = session?.user?.id ? await getOrganisationMembership(session.user.id) : null;

  const canAccess =
    !project?.organisationId || (membership?.isAdmin && membership.organisationId === project.organisationId);
  if (!canAccess) {
    redirect(`/projects/${projectId}`);
  }

  return (
    <PlaceholderSection
      title="Settings"
      description="Project settings and configuration are coming in a later build phase."
    />
  );
}
