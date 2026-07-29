import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/auth";
import { getNewBaselineDriftDeviations } from "@/lib/contract-comparison";
import { getCoverComparisonForProject } from "@/lib/insurance-cover-comparison";
import { ContractView } from "@/components/contract/contract-view";

export default async function ContractPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const session = await auth();
  const canAccess = session?.user?.id ? await requireModuleAccess(projectId, session.user.id, "contract") : false;
  if (!canAccess) {
    redirect(`/projects/${projectId}`);
  }

  const rawDocuments = await prisma.contractDocument.findMany({
    where: { projectId },
    include: {
      clauses: { orderBy: { createdAt: "desc" } },
      reviews: {
        where: { isPrimary: true },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          deviations: { orderBy: { priorityScore: "desc" } },
          comparedAgainstReview: { include: { document: { select: { title: true, fileName: true, uploadedAt: true } } } }
        }
      }
    },
    orderBy: { uploadedAt: "desc" }
  });

  const [documents, coverComparison] = await Promise.all([
    Promise.all(
      rawDocuments.map(async (document) => {
        const review = document.reviews[0];
        if (!review) return { ...document, reviews: [] as never[] };
        const driftDeviations = await getNewBaselineDriftDeviations(
          review.documentId,
          review.comparedAgainstType,
          review.newBaselineDriftCount
        );
        return { ...document, reviews: [{ ...review, driftDeviations }] };
      })
    ),
    getCoverComparisonForProject(projectId)
  ]);

  return <ContractView projectId={projectId} documents={documents} coverComparison={coverComparison} />;
}
