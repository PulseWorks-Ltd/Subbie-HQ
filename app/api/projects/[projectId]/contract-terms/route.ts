import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { getOrganisationMembership } from "@/lib/organisation";

const CONFIRMABLE_FIELDS = [
  "paymentClaimMethod",
  "paymentClaimDay",
  "variationNoticePeriodDays",
  "variationNoticeMethod",
  "delayNoticePeriodDays",
  "delayNoticeMethod",
  "retentionPercent",
  "defectsLiabilityPeriodDays",
  "disputeNoticeMethod",
  "generalNoticeMethod",
  "materialsMarkupPercent",
  "dayWorksRateNormal",
  "dayWorksRateNight",
  "dayWorksRateSundayHoliday",
  "variationScheduleType",
  "variationScheduleValue"
] as const;

const updateContractTermsSchema = z.object({
  paymentClaimMethod: z.string().nullable().optional(),
  paymentClaimDay: z.number().int().nullable().optional(),
  variationNoticePeriodDays: z.number().int().nullable().optional(),
  variationNoticeMethod: z.string().nullable().optional(),
  delayNoticePeriodDays: z.number().int().nullable().optional(),
  delayNoticeMethod: z.string().nullable().optional(),
  retentionPercent: z.number().nullable().optional(),
  defectsLiabilityPeriodDays: z.number().int().nullable().optional(),
  disputeNoticeMethod: z.string().nullable().optional(),
  generalNoticeMethod: z.string().nullable().optional(),
  materialsMarkupPercent: z.number().nullable().optional(),
  dayWorksRateNormal: z.number().nullable().optional(),
  dayWorksRateNight: z.number().nullable().optional(),
  dayWorksRateSundayHoliday: z.number().nullable().optional(),
  variationScheduleType: z.enum(["fixed_date", "working_days_before_month_end"]).nullable().optional(),
  variationScheduleValue: z.number().int().nullable().optional(),
  confirmFields: z.array(z.enum(CONFIRMABLE_FIELDS)).optional()
});

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

  const canAccessModule = await requireModuleAccess(projectId, userId, "contract");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const contractTerms = await prisma.contractTerms.findUnique({ where: { projectId } });

  return NextResponse.json({ contractTerms });
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

  const canAccessModule = await requireModuleAccess(projectId, userId, "contract");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = updateContractTermsSchema.parse(await request.json());

  // Direct field overwrites are structural project config, admin-only —
  // mirrors settings/route.ts's admin split. Confirming an AI-suggested value
  // only needs module access, same as every other confirm-a-suggestion flow.
  const changesDirectFields = CONFIRMABLE_FIELDS.some((field) => payload[field] !== undefined);
  if (changesDirectFields) {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { organisationId: true } });
    if (project?.organisationId) {
      const membership = await getOrganisationMembership(userId);
      if (!membership?.isAdmin || membership.organisationId !== project.organisationId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
  }

  const existing = await prisma.contractTerms.findUnique({ where: { projectId } });

  const confirmData: Record<string, unknown> = {};
  for (const field of payload.confirmFields ?? []) {
    const suggestedField = `suggested${field.charAt(0).toUpperCase()}${field.slice(1)}`;
    const suggestedValue = (existing as Record<string, unknown> | null)?.[suggestedField];
    if (suggestedValue !== undefined && suggestedValue !== null) {
      confirmData[field] = suggestedValue;
      confirmData[suggestedField] = null;
    }
  }

  const contractTerms = await prisma.contractTerms.upsert({
    where: { projectId },
    create: {
      projectId,
      paymentClaimMethod: payload.paymentClaimMethod ?? undefined,
      paymentClaimDay: payload.paymentClaimDay ?? undefined,
      variationNoticePeriodDays: payload.variationNoticePeriodDays ?? undefined,
      variationNoticeMethod: payload.variationNoticeMethod ?? undefined,
      delayNoticePeriodDays: payload.delayNoticePeriodDays ?? undefined,
      delayNoticeMethod: payload.delayNoticeMethod ?? undefined,
      retentionPercent: payload.retentionPercent ?? undefined,
      defectsLiabilityPeriodDays: payload.defectsLiabilityPeriodDays ?? undefined,
      disputeNoticeMethod: payload.disputeNoticeMethod ?? undefined,
      generalNoticeMethod: payload.generalNoticeMethod ?? undefined,
      materialsMarkupPercent: payload.materialsMarkupPercent ?? undefined,
      dayWorksRateNormal: payload.dayWorksRateNormal ?? undefined,
      dayWorksRateNight: payload.dayWorksRateNight ?? undefined,
      dayWorksRateSundayHoliday: payload.dayWorksRateSundayHoliday ?? undefined,
      variationScheduleType: payload.variationScheduleType ?? undefined,
      variationScheduleValue: payload.variationScheduleValue ?? undefined,
      ...confirmData
    },
    update: {
      paymentClaimMethod: payload.paymentClaimMethod,
      paymentClaimDay: payload.paymentClaimDay,
      variationNoticePeriodDays: payload.variationNoticePeriodDays,
      variationNoticeMethod: payload.variationNoticeMethod,
      delayNoticePeriodDays: payload.delayNoticePeriodDays,
      delayNoticeMethod: payload.delayNoticeMethod,
      retentionPercent: payload.retentionPercent,
      defectsLiabilityPeriodDays: payload.defectsLiabilityPeriodDays,
      disputeNoticeMethod: payload.disputeNoticeMethod,
      generalNoticeMethod: payload.generalNoticeMethod,
      materialsMarkupPercent: payload.materialsMarkupPercent,
      dayWorksRateNormal: payload.dayWorksRateNormal,
      dayWorksRateNight: payload.dayWorksRateNight,
      dayWorksRateSundayHoliday: payload.dayWorksRateSundayHoliday,
      variationScheduleType: payload.variationScheduleType,
      variationScheduleValue: payload.variationScheduleValue,
      ...confirmData
    }
  });

  return NextResponse.json({ contractTerms });
}
