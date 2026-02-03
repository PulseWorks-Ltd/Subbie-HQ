import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, requireUserId } from "@/lib/auth";

export async function GET(request: Request, context: { params: { projectId: string } }) {
  const userId = await requireUserId(request);
  const { projectId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      clauses: { select: { riskLevel: true } },
      scopeItems: { select: { status: true } },
      programmeItems: { select: { confidence: true } }
    }
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  type RiskCounts = { low: number; medium: number; high: number };
  const typedClauses = project.clauses as Array<{ riskLevel: string }>;
  const typedScopeItems = project.scopeItems as Array<{ status: string }>;

  const riskCounts = typedClauses.reduce(
    (acc: RiskCounts, clause: { riskLevel: string }) => {
      const key = clause.riskLevel as keyof RiskCounts;
      acc[key] += 1;
      return acc;
    },
    { low: 0, medium: 0, high: 0 }
  );

  const scopeTotals = typedScopeItems.reduce(
    (acc: { total: number; confirmed: number }, item: { status: string }) => {
      acc.total += 1;
      if (item.status === "confirmed") acc.confirmed += 1;
      return acc;
    },
    { total: 0, confirmed: 0 }
  );

  const typedProgrammeItems = project.programmeItems as Array<{ confidence: number | null }>;
  const programmeConfidence = typedProgrammeItems.length
    ? typedProgrammeItems.reduce(
        (sum: number, item: { confidence: number | null }) => sum + (item.confidence ?? 0),
        0
      ) / typedProgrammeItems.length
    : 0;

  return NextResponse.json({
    project: {
      id: project.id,
      name: project.name,
      code: project.code,
      status: project.status,
      riskLevel: project.riskLevel,
      nextClaimDate: project.nextClaimDate
    },
    aggregates: {
      contractRiskSummary: riskCounts,
      scopeCompleteness: scopeTotals,
      programmeConfidence
    }
  });
}
