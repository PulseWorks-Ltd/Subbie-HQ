import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, requireUserId } from "@/lib/auth";

const linkSchema = z.object({
  scopeItemIds: z.array(z.string()).optional(),
  programmeItemIds: z.array(z.string()).optional(),
  paymentClaimIds: z.array(z.string()).optional()
});

export async function POST(
  request: Request,
  context: { params: { projectId: string; evidenceId: string } }
) {
  const userId = await requireUserId(request);
  const { projectId, evidenceId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = linkSchema.parse(await request.json());

  if (payload.scopeItemIds) {
    await prisma.evidenceScopeItem.deleteMany({ where: { evidenceId } });
    if (payload.scopeItemIds.length) {
      await prisma.evidenceScopeItem.createMany({
        data: payload.scopeItemIds.map((scopeItemId) => ({
          evidenceId,
          scopeItemId
        })),
        skipDuplicates: true
      });
    }
  }

  if (payload.programmeItemIds) {
    await prisma.evidenceProgrammeItem.deleteMany({ where: { evidenceId } });
    if (payload.programmeItemIds.length) {
      await prisma.evidenceProgrammeItem.createMany({
        data: payload.programmeItemIds.map((programmeItemId) => ({
          evidenceId,
          programmeItemId
        })),
        skipDuplicates: true
      });
    }
  }

  if (payload.paymentClaimIds) {
    await prisma.evidencePaymentClaim.deleteMany({ where: { evidenceId } });
    if (payload.paymentClaimIds.length) {
      await prisma.evidencePaymentClaim.createMany({
        data: payload.paymentClaimIds.map((paymentClaimId) => ({
          evidenceId,
          paymentClaimId
        })),
        skipDuplicates: true
      });
    }
  }

  return NextResponse.json({ ok: true });
}
