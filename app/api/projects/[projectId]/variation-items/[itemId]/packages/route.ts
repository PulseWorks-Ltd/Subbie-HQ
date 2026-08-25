import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { generateAndStoreVariationPackage } from "@/lib/variation-package-generation";
import { PACKAGE_CATEGORIES } from "@/lib/variation-package";

// Missing/malformed body defaults to every category (matches the
// long-standing unconditional behaviour this endpoint had before
// per-generation filtering existed).
const generatePackageSchema = z.object({
  includedCategories: z.array(z.enum(PACKAGE_CATEGORIES)).optional()
});

async function moduleForItem(projectId: string, itemId: string) {
  const item = await prisma.variationItem.findFirst({ where: { id: itemId, projectId }, select: { type: true } });
  if (!item) return null;
  return item.type === "variation" ? ("variations" as const) : ("site_instructions" as const);
}

// Generates an immutable snapshot PDF from everything CURRENTLY attached
// to this Variation/SI, uploads it, and stores both the file location and
// the computed totals as a new VariationPackage row. Deliberately
// re-fetches and recomputes everything server-side rather than trusting
// whatever totals the client's confirm screen showed — that screen is a
// preview of this same data, not the source of truth for what gets
// frozen. Nothing here is ever updated in place; generating again later
// (after evidence changes) creates a new row, on purpose (see this
// feature's task notes on immutability).
export async function POST(request: Request, context: { params: { projectId: string; itemId: string } }) {
  const userId = await requireUserId(request);
  const { projectId, itemId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const module_ = await moduleForItem(projectId, itemId);
  if (!module_) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const canAccessModule = await requireModuleAccess(projectId, userId, module_);
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rawBody = await request.json().catch(() => ({}));
  const parsed = generatePackageSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid category selection" }, { status: 400 });
  }
  const includedCategories = parsed.data.includedCategories ?? [...PACKAGE_CATEGORIES];

  const variationPackage = await generateAndStoreVariationPackage({
    projectId,
    itemId,
    generatedByUserId: userId,
    includedCategories
  });
  if (!variationPackage) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ variationPackage }, { status: 201 });
}
