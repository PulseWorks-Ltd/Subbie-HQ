import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { requireOrganisationAdmin } from "@/lib/organisation";
import { INSURANCE_TYPE_LABELS } from "@/lib/insurance-labels";

// "Send to all active projects" — idempotent: only distributes to projects
// that don't already have a distribution record for this certificate, so
// clicking it again doesn't spam duplicate Correspondence entries into
// projects that already received it.
export async function POST(request: Request, context: { params: { certificateId: string } }) {
  const userId = await requireUserId(request);
  const { certificateId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = await requireOrganisationAdmin(userId);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const certificate = await prisma.insuranceCertificate.findFirst({
    where: { id: certificateId, organisationId: admin.organisationId }
  });
  if (!certificate) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const activeProjects = await prisma.project.findMany({
    where: { organisationId: admin.organisationId, status: "active" },
    select: { id: true }
  });

  const alreadySent = await prisma.insuranceDistribution.findMany({
    where: { insuranceCertificateId: certificateId, projectId: { in: activeProjects.map((p) => p.id) } },
    select: { projectId: true }
  });
  const alreadySentSet = new Set(alreadySent.map((d) => d.projectId));
  const targetProjectIds = activeProjects.map((p) => p.id).filter((id) => !alreadySentSet.has(id));

  const sentAt = new Date();
  const typeLabel = INSURANCE_TYPE_LABELS[certificate.type] ?? certificate.type;
  const dateLabel = sentAt.toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });

  for (const projectId of targetProjectIds) {
    await prisma.insuranceDistribution.create({
      data: { insuranceCertificateId: certificateId, projectId, sentAt }
    });
    await prisma.correspondence.create({
      data: {
        projectId,
        title: `Insurance certificate — ${typeLabel} — sent ${dateLabel}`,
        source: "upload",
        sourceInsuranceCertificateId: certificateId
      }
    });
  }

  return NextResponse.json({ sentToCount: targetProjectIds.length, alreadyHadCount: alreadySentSet.size });
}
