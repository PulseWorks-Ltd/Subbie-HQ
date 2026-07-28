import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrganisationMembership } from "@/lib/organisation";
import { hasModuleAccess } from "@/lib/permissions";
import { InsuranceCertificatesView } from "@/components/insurance/insurance-certificates-view";

export default async function InsurancePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const membership = await getOrganisationMembership(session.user.id);
  if (!hasModuleAccess(membership, "insurance")) {
    redirect("/");
  }

  const [certificates, activeProjects] = await Promise.all([
    prisma.insuranceCertificate.findMany({
      where: { organisationId: membership!.organisationId },
      include: { distributions: { include: { project: { select: { id: true, name: true } } }, orderBy: { sentAt: "desc" } } },
      orderBy: { createdAt: "desc" }
    }),
    prisma.project.findMany({
      where: { organisationId: membership!.organisationId, status: "active" },
      select: { id: true }
    })
  ]);

  return (
    <InsuranceCertificatesView
      certificates={certificates}
      activeProjectCount={activeProjects.length}
      isAdmin={membership!.isAdmin}
    />
  );
}
