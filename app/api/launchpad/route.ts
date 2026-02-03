import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";

function computeRiskLevel(levels: string[]) {
  if (levels.includes("high")) return "high";
  if (levels.includes("medium")) return "medium";
  return "low";
}

export async function GET(request: Request) {
  const userId = await requireUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
  })) as LaunchpadProject[];

  type LaunchpadProject = {
    id: string;
    name: string;
    code: string | null;
    status: string;
    nextClaimDate: Date | null;
    clauses: { riskLevel: string }[];
    paymentClaims: { referenceDate: Date }[];
  };

  const response = projects.map((project: LaunchpadProject) => {
    const riskLevel = computeRiskLevel(project.clauses.map((clause) => clause.riskLevel));
    const nextClaimDate = project.nextClaimDate ?? project.paymentClaims[0]?.referenceDate ?? null;

    return {
      id: project.id,
      name: project.name,
      code: project.code,
      status: project.status,
      riskLevel,
      nextPaymentClaimDate: nextClaimDate
    };
  });

  return NextResponse.json({ projects: response });
}
