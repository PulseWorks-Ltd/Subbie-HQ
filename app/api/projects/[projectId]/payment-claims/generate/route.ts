import { NextResponse } from "next/server";
import { Decimal } from "@prisma/client/runtime/library";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, requireUserId } from "@/lib/auth";
import { generatePaymentClaimPdf } from "@/lib/pdf";
import { uploadToS3 } from "@/lib/s3";

const generateSchema = z.object({
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  referenceDate: z.string().datetime(),
  evidenceIds: z.array(z.string()).optional(),
  statutoryWording: z.string().optional(),
  serviceDate: z.string().datetime().optional()
});

export async function POST(request: Request, context: { params: { projectId: string } }) {
  const userId = await requireUserId(request);
  const { projectId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = generateSchema.parse(await request.json());

  const [latestClaim, project, workRecords, variations] = await Promise.all([
    prisma.paymentClaim.findFirst({
      where: { projectId },
      orderBy: { claimNumber: "desc" }
    }),
    prisma.project.findUnique({ where: { id: projectId } }),
    prisma.monthlyWorkRecord.findMany({
      where: {
        projectId,
        periodStart: { gte: new Date(payload.periodStart) },
        periodEnd: { lte: new Date(payload.periodEnd) }
      }
    }),
    prisma.variation.findMany({
      where: {
        projectId,
        status: "approved"
      }
    })
  ]);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const claimNumber = (latestClaim?.claimNumber ?? 0) + 1;
  const typedWorkRecords = workRecords as Array<{ completedValue: Decimal }>;
  const typedVariations = variations as Array<{ amount: Decimal }>;

  const workTotal = typedWorkRecords.reduce(
    (sum: Decimal, record) => sum.plus(record.completedValue),
    new Decimal(0)
  );
  const variationTotal = typedVariations.reduce(
    (sum: Decimal, variation) => sum.plus(variation.amount),
    new Decimal(0)
  );

  // TODO: Refine claim calculation to align with contract-specific valuation rules.
  const claimedAmount = workTotal.plus(variationTotal);
  const statutoryWording =
    payload.statutoryWording ??
    "This is a payment claim made under the Building and Construction Industry Security of Payment Act 1999 (NSW).";

  const pdfBytes = await generatePaymentClaimPdf({
    projectName: project.name,
    claimNumber,
    referenceDate: new Date(payload.referenceDate),
    claimedAmount: `$${claimedAmount.toFixed(2)}`,
    statutoryWording
  });

  const pdfKey = `projects/${projectId}/claims/claim-${claimNumber}.pdf`;
  const { fileUrl, storageKey } = await uploadToS3({
    key: pdfKey,
    body: pdfBytes,
    contentType: "application/pdf"
  });

  const claim = await prisma.paymentClaim.create({
    data: {
      projectId,
      claimNumber,
      referenceDate: new Date(payload.referenceDate),
      periodStart: new Date(payload.periodStart),
      periodEnd: new Date(payload.periodEnd),
      claimedAmount,
      statutoryWording,
      serviceDate: payload.serviceDate ? new Date(payload.serviceDate) : undefined,
      pdfUrl: fileUrl,
      storageKey
    }
  });

  if (payload.evidenceIds?.length) {
    await prisma.evidencePaymentClaim.createMany({
      data: payload.evidenceIds.map((evidenceId) => ({
        evidenceId,
        paymentClaimId: claim.id
      })),
      skipDuplicates: true
    });
  }

  return NextResponse.json({ claim }, { status: 201 });
}
