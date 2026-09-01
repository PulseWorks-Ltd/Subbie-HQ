import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { reactivateVariationItem } from "@/lib/variation-item-lifecycle";

const reactivateSchema = z.object({ note: z.string().optional() });

async function moduleForItem(projectId: string, itemId: string) {
  const item = await prisma.variationItem.findFirst({ where: { id: itemId, projectId }, select: { type: true } });
  if (!item) return null;
  return item.type === "variation" ? ("variations" as const) : ("site_instructions" as const);
}

// Reactivation is always deliberate — either a direct click on a closed
// item's own page, or accepting "Yes — Reactivate" after the duplicate-
// detection resolver surfaces a closed match during creation elsewhere.
// Never resets the completion status; the prior close event is never
// modified, only a new `reactivated` event is added (see
// lib/record-lifecycle-log.ts).
export async function POST(request: Request, context: { params: { projectId: string; itemId: string } }) {
  const userId = await requireUserId(request);
  const { projectId, itemId } = context.params;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireProjectAccess(projectId, userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const module_ = await moduleForItem(projectId, itemId);
  if (!module_) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await requireModuleAccess(projectId, userId, module_))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = reactivateSchema.parse(await request.json().catch(() => ({})));
  await reactivateVariationItem({ variationItemId: itemId, userId, note: payload.note });

  return NextResponse.json({ ok: true });
}
