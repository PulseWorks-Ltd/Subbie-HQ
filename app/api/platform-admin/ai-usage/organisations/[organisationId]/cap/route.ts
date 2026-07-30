import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";

// null = cap disabled for this organisation (the platform owner's override
// to instantly unblock one mid-month, or to permanently exempt an org
// they've separately negotiated with) — distinct from 0, which would block
// every AI call.
const requestSchema = z.object({ capUsd: z.number().min(0).nullable() });

export async function PATCH(request: Request, context: { params: { organisationId: string } }) {
  const userId = await requireUserId(request);
  if (!userId || !(await isPlatformAdmin(userId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { organisationId } = context.params;
  const payload = requestSchema.parse(await request.json());

  const organisation = await prisma.organisation.update({
    where: { id: organisationId },
    data: { aiMonthlySpendCapUsd: payload.capUsd },
    select: { id: true, name: true, aiMonthlySpendCapUsd: true }
  });

  return NextResponse.json({
    organisation: {
      ...organisation,
      aiMonthlySpendCapUsd: organisation.aiMonthlySpendCapUsd !== null ? Number(organisation.aiMonthlySpendCapUsd) : null
    }
  });
}
