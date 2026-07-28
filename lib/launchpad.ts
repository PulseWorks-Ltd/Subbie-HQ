import { prisma } from "./prisma";
import { getVisibleProjectsWhere } from "./organisation";

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
  nextSiteInstructionDueDate: Date | null;
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
    siteInstructions: { dueAt: Date | null }[];
  };

  const projects = (await prisma.project.findMany({
    where: await getVisibleProjectsWhere(userId),
    include: {
      clauses: {
        select: { riskLevel: true }
      },
      paymentClaims: {
        select: { referenceDate: true },
        orderBy: { referenceDate: "desc" },
        take: 1
      },
      siteInstructions: {
        where: { status: "open", dueAt: { not: null } },
        select: { dueAt: true },
        orderBy: { dueAt: "asc" },
        take: 1
      }
    },
    orderBy: { createdAt: "desc" }
  })) as ProjectWithRelations[];

  return projects.map((project) => {
    const riskLevel = computeRiskLevel(project.clauses.map((clause) => clause.riskLevel));
    const nextPaymentClaimDate = project.nextClaimDate ?? project.paymentClaims[0]?.referenceDate ?? null;
    const nextSiteInstructionDueDate = project.siteInstructions[0]?.dueAt ?? null;

    return {
      id: project.id,
      name: project.name,
      code: project.code,
      status: project.status,
      riskLevel,
      nextPaymentClaimDate,
      nextSiteInstructionDueDate
    };
  });
}
