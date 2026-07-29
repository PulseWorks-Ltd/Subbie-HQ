import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrganisationMembership } from "@/lib/organisation";
import { hasModuleAccess } from "@/lib/permissions";
import { MainContractorsView } from "@/components/main-contractors/main-contractors-view";

export default async function MainContractorsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const membership = await getOrganisationMembership(session.user.id);
  if (!hasModuleAccess(membership, "main_contractors")) {
    redirect("/");
  }

  const mainContractors = await prisma.mainContractor.findMany({
    where: { organisationId: membership!.organisationId },
    include: {
      contacts: { orderBy: { createdAt: "asc" } },
      projects: { select: { id: true, status: true } }
    },
    orderBy: { name: "asc" }
  });

  return <MainContractorsView mainContractors={mainContractors} isAdmin={membership!.isAdmin} />;
}
