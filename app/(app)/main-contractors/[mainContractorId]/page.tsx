import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrganisationMembership } from "@/lib/organisation";
import { hasModuleAccess } from "@/lib/permissions";
import { MainContractorDetailView } from "@/components/main-contractors/main-contractor-detail-view";

export default async function MainContractorDetailPage({
  params
}: {
  params: Promise<{ mainContractorId: string }>;
}) {
  const { mainContractorId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const membership = await getOrganisationMembership(session.user.id);
  if (!hasModuleAccess(membership, "main_contractors")) {
    redirect("/");
  }

  const mainContractor = await prisma.mainContractor.findFirst({
    where: { id: mainContractorId, organisationId: membership!.organisationId },
    include: {
      contacts: { orderBy: { createdAt: "asc" } },
      projects: { select: { id: true, name: true, status: true, jobNumber: true }, orderBy: { createdAt: "desc" } }
    }
  });
  if (!mainContractor) {
    notFound();
  }

  return <MainContractorDetailView mainContractor={mainContractor} isAdmin={membership!.isAdmin} />;
}
