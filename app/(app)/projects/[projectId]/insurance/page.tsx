import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/auth";
import { InsuranceView } from "@/components/insurance/insurance-view";

export default async function InsurancePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const session = await auth();
  const canAccess = session?.user?.id ? await requireModuleAccess(projectId, session.user.id, "insurance") : false;
  if (!canAccess) {
    redirect(`/projects/${projectId}`);
  }

  const rows = await prisma.insuranceRequirement.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" }
  });

  // Prisma's Decimal isn't safely serializable across the server/client
  // component boundary — convert to a plain number before passing down.
  const insuranceRequirements = rows.map((row) => ({
    ...row,
    minimumAmount: row.minimumAmount ? Number(row.minimumAmount) : null
  }));

  return <InsuranceView projectId={projectId} insuranceRequirements={insuranceRequirements} />;
}
