import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { itemInputSchema, validateComponents } from "@/lib/contract-schedule-schemas";
import { buildContractItemCreateData } from "@/lib/contract-schedule";

const confirmSchema = z.object({
  sourceFileName: z.string().optional(),
  sourceStorageKey: z.string().optional(),
  sourceContentType: z.string().optional(),
  defaultErectPercent: z.number().min(0).max(100).nullable().optional(),
  defaultDismantlePercent: z.number().min(0).max(100).nullable().optional(),
  items: z.array(itemInputSchema).min(1)
});

// Persists a (possibly user-edited) extraction as real ContractItem rows —
// the review step itself happens client-side (the extraction route never
// writes any ContractItem/Component/Phase rows on its own), so by the time
// this is called every item has already been looked at by a person. Reuses
// the exact same nested-create mapping the plain "add one item" route
// uses (buildContractItemCreateData), just once per extracted item, so a
// bulk confirm can never drift from what manual entry produces.
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
  const canAccessModule = await requireModuleAccess(projectId, userId, "payment_claims");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = confirmSchema.parse(await request.json());
  for (const item of payload.items) {
    const validationError = validateComponents(item.components);
    if (validationError) {
      return NextResponse.json({ error: `"${item.description}": ${validationError}` }, { status: 400 });
    }
  }

  const schedule = await prisma.contractSchedule.upsert({
    where: { projectId },
    update: {
      sourceFileName: payload.sourceFileName,
      sourceStorageKey: payload.sourceStorageKey,
      sourceContentType: payload.sourceContentType,
      defaultErectPercent: payload.defaultErectPercent,
      defaultDismantlePercent: payload.defaultDismantlePercent,
      status: "confirmed",
      extractedAt: new Date()
    },
    create: {
      projectId,
      sourceFileName: payload.sourceFileName,
      sourceStorageKey: payload.sourceStorageKey,
      sourceContentType: payload.sourceContentType,
      defaultErectPercent: payload.defaultErectPercent,
      defaultDismantlePercent: payload.defaultDismantlePercent,
      status: "confirmed",
      extractedAt: new Date()
    }
  });

  await prisma.$transaction(
    payload.items.map((item, index) => prisma.contractItem.create({ data: buildContractItemCreateData(schedule.id, item, index) }))
  );

  return NextResponse.json({ ok: true, scheduleId: schedule.id }, { status: 201 });
}
