import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { getRetentionSummary } from "@/lib/retention";

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
  const canAccessModule = await requireModuleAccess(projectId, userId, "payment_claims");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const summary = await getRetentionSummary(projectId);
  return NextResponse.json({ summary });
}

// A single PATCH covers every editable field on the Retention row — the
// card on the Payment Claims page edits at most a couple of fields at a
// time, so there's no need for the per-tranche split routes a bigger
// surface might warrant. release amount/date are set together (marking a
// tranche released without an amount, or vice versa, isn't a real state
// worth allowing).
const patchSchema = z.object({
  practicalCompletionDateOverride: z.string().nullable().optional(),
  tranche1ExpectedDate: z.string().nullable().optional(),
  tranche1Percent: z.number().min(0).max(100).nullable().optional(),
  tranche1ReleasedAmount: z.number().min(0).nullable().optional(),
  tranche1ReleasedAt: z.string().nullable().optional(),
  tranche2ExpectedDate: z.string().nullable().optional(),
  tranche2Percent: z.number().min(0).max(100).nullable().optional(),
  tranche2ReleasedAmount: z.number().min(0).nullable().optional(),
  tranche2ReleasedAt: z.string().nullable().optional()
});

function toDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  return value === null ? null : new Date(value);
}

export async function PATCH(request: Request, context: { params: { projectId: string } }) {
  const userId = await requireUserId(request);
  const { projectId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const canAccessModule = await requireModuleAccess(projectId, userId, "payment_claims");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = patchSchema.parse(await request.json());
  const data = {
    practicalCompletionDateOverride: toDate(payload.practicalCompletionDateOverride),
    tranche1ExpectedDate: toDate(payload.tranche1ExpectedDate),
    tranche1Percent: payload.tranche1Percent,
    tranche1ReleasedAmount: payload.tranche1ReleasedAmount,
    tranche1ReleasedAt: toDate(payload.tranche1ReleasedAt),
    tranche2ExpectedDate: toDate(payload.tranche2ExpectedDate),
    tranche2Percent: payload.tranche2Percent,
    tranche2ReleasedAmount: payload.tranche2ReleasedAmount,
    tranche2ReleasedAt: toDate(payload.tranche2ReleasedAt)
  };

  await prisma.retention.upsert({
    where: { projectId },
    update: data,
    create: { projectId, ...data }
  });

  const summary = await getRetentionSummary(projectId);
  return NextResponse.json({ summary });
}
