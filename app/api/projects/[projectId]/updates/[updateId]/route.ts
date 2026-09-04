import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { UPDATE_CATEGORIES } from "@/lib/update-category";
import { setContractItemDiaryLinks } from "@/lib/contract-schedule";

// variationItemId, qaRecordId, and category are still mutually exclusive
// (see schema comment on Update.category) — whichever one is sent always
// clears the other two. freeTextSiteInstructionReference travels alongside
// category (it's only meaningful when category is "variation" and the
// caller picked "enter own Site Instruction"; sending it any other time is
// harmless since it's only ever read in that one context). contractItemIds
// is a genuinely independent field — Pre-Launch Feature 1's "Assign to
// Contract Works" links a diary entry to Contract Works regardless of
// what (if anything) its tag is, so it can be sent alone, or alongside a
// tag change, without tripping the exclusivity check below. Fields use
// `.optional()` (not just `.nullable()`) so parse can tell "not sent" (the
// key is a real JS `undefined`) apart from "sent null" (explicitly
// clearing it) — the exclusivity check below depends on that distinction.
const patchSchema = z
  .object({
    variationItemId: z.string().nullable().optional(),
    qaRecordId: z.string().nullable().optional(),
    category: z.enum(UPDATE_CATEGORIES as [string, ...string[]]).nullable().optional(),
    freeTextSiteInstructionReference: z.string().nullable().optional(),
    contractItemIds: z.array(z.string()).optional()
  })
  .refine(
    (data) => ["variationItemId", "qaRecordId", "category"].filter((key) => data[key as keyof typeof data] !== undefined).length <= 1,
    { message: "variationItemId, qaRecordId, and category are mutually exclusive." }
  );

// Lets a user tag (or change/clear the tag on) an already-posted Update —
// at compose time this can only be set once, but in practice which SI/
// Variation (or QA record, or category) an Update relates to often only
// becomes clear later. Top-level updates only, matching the existing rule
// that replies don't carry their own tag (they inherit whatever their
// parent thread is tagged to). Note: the "Assign QA" tag option doesn't
// call this route directly — creating a new QARecord from an Update's
// attachments goes through the qa-records POST route (source: { type:
// "update" }), which sets qaRecordId itself as part of that transaction.
// This route mainly exists for "Not Assigned" / picking a different
// Variation/SI / picking a category.
export async function PATCH(request: Request, context: { params: { projectId: string; updateId: string } }) {
  const userId = await requireUserId(request);
  const { projectId, updateId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const canAccessModule = await requireModuleAccess(projectId, userId, "updates");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const update = await prisma.update.findFirst({ where: { id: updateId, projectId } });
  if (!update) {
    return NextResponse.json({ error: "Update not found." }, { status: 404 });
  }
  if (update.parentId !== null) {
    return NextResponse.json({ error: "A reply can't carry its own tag — tag the original update instead." }, { status: 400 });
  }

  const payload = patchSchema.parse(await request.json());

  // Only one of these three ever gets touched per the exclusivity refine
  // above — `data` stays empty (skipping the write below) on a
  // contractItemIds-only patch that doesn't change the tag at all.
  const data: {
    variationItemId?: string | null;
    qaRecordId?: string | null;
    category?: (typeof UPDATE_CATEGORIES)[number] | null;
    freeTextSiteInstructionReference?: string | null;
  } = {};

  if (payload.variationItemId !== undefined) {
    if (payload.variationItemId) {
      const item = await prisma.variationItem.findFirst({ where: { id: payload.variationItemId, projectId } });
      if (!item) {
        return NextResponse.json({ error: "Variation/Site Instruction not found." }, { status: 400 });
      }
    }
    data.variationItemId = payload.variationItemId;
    data.qaRecordId = null;
    data.category = null;
    data.freeTextSiteInstructionReference = null;
  } else if (payload.qaRecordId !== undefined) {
    if (payload.qaRecordId) {
      const record = await prisma.qARecord.findFirst({ where: { id: payload.qaRecordId, projectId } });
      if (!record) {
        return NextResponse.json({ error: "QA record not found." }, { status: 400 });
      }
    }
    data.qaRecordId = payload.qaRecordId;
    data.variationItemId = null;
    data.category = null;
    data.freeTextSiteInstructionReference = null;
  } else if (payload.category !== undefined) {
    data.category = payload.category as (typeof UPDATE_CATEGORIES)[number] | null;
    data.variationItemId = null;
    data.qaRecordId = null;
    // Only "variation" + the free-text branch actually uses this — sent as
    // null in every other case so switching away from that branch clears
    // any previously-entered free text rather than leaving it stranded.
    data.freeTextSiteInstructionReference = payload.freeTextSiteInstructionReference ?? null;
  }

  if (Object.keys(data).length > 0) {
    await prisma.update.update({ where: { id: updateId }, data });
  }

  if (payload.contractItemIds !== undefined) {
    const items = await prisma.contractItem.findMany({
      where: { id: { in: payload.contractItemIds }, schedule: { projectId } },
      select: { id: true }
    });
    if (items.length !== payload.contractItemIds.length) {
      return NextResponse.json({ error: "One or more Contract Works items were not found." }, { status: 400 });
    }
    await setContractItemDiaryLinks(updateId, payload.contractItemIds);
  }

  const updated = await prisma.update.findUniqueOrThrow({ where: { id: updateId } });

  return NextResponse.json({ update: updated });
}
