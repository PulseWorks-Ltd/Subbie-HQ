import { prisma } from "./prisma";

function computeRiskLevel(levels: string[]) {
  if (levels.includes("high")) return "high";
  if (levels.includes("medium")) return "medium";
  return "low";
}

export type LaunchpadProject = {
  id: string;
  name: string;
  code: string | null;
  status: string;
  riskLevel: string;
  nextPaymentClaimDate: Date | null;
};

export async function getLaunchpadProjects(userId: string): Promise<LaunchpadProject[]> {
  type ProjectWithRelations = {
    id: string;
    name: string;
    code: string | null;
    status: string;
    nextClaimDate: Date | null;
    clauses: { riskLevel: string }[];
    paymentClaims: { referenceDate: Date }[];
  };

  const projects = (await prisma.project.findMany({
    where: {
      members: {
        some: { userId }
      }
    },
    include: {
      clauses: {
        select: { riskLevel: true }
      },
      paymentClaims: {
        select: { referenceDate: true },
        orderBy: { referenceDate: "desc" },
        take: 1
      }
    },
    orderBy: { createdAt: "desc" }
  })) as ProjectWithRelations[];

  return projects.map((project) => {
    const riskLevel = computeRiskLevel(project.clauses.map((clause) => clause.riskLevel));
    const nextPaymentClaimDate = project.nextClaimDate ?? project.paymentClaims[0]?.referenceDate ?? null;

    return {
      id: project.id,
      name: project.name,
      code: project.code,
      status: project.status,
      riskLevel,
      nextPaymentClaimDate
    };
  });
}
