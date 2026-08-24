import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { UPDATE_CATEGORIES } from "@/lib/update-category";

// variationItemId, qaRecordId, and category are all mutually exclusive (see
// schema comment on Update.category) — whichever one is sent always clears
// the other two, so a client only ever needs to send the field it's
// actually setting.
const patchSchema = z.union([
  z.object({ variationItemId: z.string().nullable() }),
  z.object({ qaRecordId: z.string().nullable() }),
  z.object({ category: z.enum(UPDATE_CATEGORIES as [string, ...string[]]).nullable() })
]);

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

  let variationItemId: string | null = null;
  let qaRecordId: string | null = null;
  let category: (typeof UPDATE_CATEGORIES)[number] | null = null;

  if ("variationItemId" in payload) {
    variationItemId = payload.variationItemId;
    if (variationItemId) {
      const item = await prisma.variationItem.findFirst({ where: { id: variationItemId, projectId } });
      if (!item) {
        return NextResponse.json({ error: "Variation/Site Instruction not found." }, { status: 400 });
      }
    }
  } else if ("qaRecordId" in payload) {
    qaRecordId = payload.qaRecordId;
    if (qaRecordId) {
      const record = await prisma.qARecord.findFirst({ where: { id: qaRecordId, projectId } });
      if (!record) {
        return NextResponse.json({ error: "QA record not found." }, { status: 400 });
      }
    }
  } else {
    category = payload.category as (typeof UPDATE_CATEGORIES)[number] | null;
  }

  const updated = await prisma.update.update({
    where: { id: updateId },
    data: { variationItemId, qaRecordId, category }
  });

  return NextResponse.json({ update: updated });
}
