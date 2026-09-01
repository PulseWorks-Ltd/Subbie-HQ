import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { closeVariationItem, reviewVariationItemForClosure } from "@/lib/variation-item-lifecycle";

const closeSchema = z.object({ force: z.boolean().optional(), note: z.string().optional() });

async function moduleForItem(projectId: string, itemId: string) {
  const item = await prisma.variationItem.findFirst({ where: { id: itemId, projectId }, select: { type: true } });
  if (!item) return null;
  return item.type === "variation" ? ("variations" as const) : ("site_instructions" as const);
}

// Closes the ONE shared VariationItem row from active operational use —
// whether it's currently "just an SI" or has also become a Variation, this
// is the same closure dimension either way (see the schema comment on
// VariationItem.closedAt). GET returns the closure-review checks without
// closing anything, so the UI can show the warning dialog before the user
// commits; POST actually closes (with force required if warnings exist).
export async function GET(request: Request, context: { params: { projectId: string; itemId: string } }) {
  const userId = await requireUserId(request);
  const { projectId, itemId } = context.params;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireProjectAccess(projectId, userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const module_ = await moduleForItem(projectId, itemId);
  if (!module_) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await requireModuleAccess(projectId, userId, module_))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const review = await reviewVariationItemForClosure(itemId);
  return NextResponse.json({ review });
}

export async function POST(request: Request, context: { params: { projectId: string; itemId: string } }) {
  const userId = await requireUserId(request);
  const { projectId, itemId } = context.params;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireProjectAccess(projectId, userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const module_ = await moduleForItem(projectId, itemId);
  if (!module_) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await requireModuleAccess(projectId, userId, module_))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = closeSchema.parse(await request.json().catch(() => ({})));
  const result = await closeVariationItem({ variationItemId: itemId, userId, force: payload.force, note: payload.note });

  if (!result.ok) {
    return NextResponse.json({ ok: false, review: result.warnings }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
