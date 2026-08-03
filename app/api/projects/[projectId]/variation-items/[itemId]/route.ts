import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { deleteFromS3 } from "@/lib/s3";

const updateVariationItemSchema = z.object({
  title: z.string().min(1).optional(),
  reference: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(["draft", "open", "submitted_for_claim", "complete"]).optional(),
  percentComplete: z.number().min(0).max(100).nullable().optional(),
  notifiedAt: z.string().datetime().optional(),
  dueAt: z.string().datetime().optional(),
  instructedByName: z.string().optional().nullable(),
  // Admin/PM-only: applies the pending suggested % (from an Update tag under
  // "requires confirmation" mode) as the real percentComplete.
  confirmSuggested: z.boolean().optional(),
  // Adds a Variation identity to a Site Instruction-origin item — see the
  // schema comment on VariationItem.variationCreatedAt. Requires "variations"
  // module access specifically, checked below, on top of whatever module the
  // item's own type already requires.
  createVariation: z.boolean().optional(),
  variationValue: z.number().min(0).nullable().optional()
});

async function moduleForItem(projectId: string, itemId: string) {
  const item = await prisma.variationItem.findFirst({ where: { id: itemId, projectId }, select: { type: true } });
  if (!item) return null;
  return item.type === "variation" ? ("variations" as const) : ("site_instructions" as const);
}

export async function PATCH(request: Request, context: { params: { projectId: string; itemId: string } }) {
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

  const payload = updateVariationItemSchema.parse(await request.json());

  if (payload.confirmSuggested) {
    const current = await prisma.variationItem.findFirst({ where: { id: itemId, projectId } });
    const variationItem = await prisma.variationItem.update({
      where: { id: itemId, projectId },
      data: {
        percentComplete: current?.suggestedPercentComplete ?? current?.percentComplete,
        suggestedPercentComplete: null
      }
    });
    return NextResponse.json({ variationItem });
  }

  let variationCreatedAt: Date | undefined;
  if (payload.createVariation) {
    // Adding a Variation identity is meaningfully a "variations" action —
    // require that module specifically, on top of whatever module the
    // item's own origin type already required above (e.g. a
    // site_instructions-only user can't do this).
    const canCreateVariation = await requireModuleAccess(projectId, userId, "variations");
    if (!canCreateVariation) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const current = await prisma.variationItem.findFirst({
      where: { id: itemId, projectId },
      select: { variationCreatedAt: true }
    });
    // Idempotent — calling this again on an item that already has a
    // Variation identity just leaves the original timestamp alone.
    variationCreatedAt = current?.variationCreatedAt ?? new Date();
  }

  const variationItem = await prisma.variationItem.update({
    where: { id: itemId, projectId },
    data: {
      title: payload.title,
      reference: payload.reference,
      description: payload.description ?? undefined,
      status: payload.status,
      percentComplete: payload.percentComplete === undefined ? undefined : payload.percentComplete,
      notifiedAt: payload.notifiedAt ? new Date(payload.notifiedAt) : undefined,
      dueAt: payload.dueAt ? new Date(payload.dueAt) : undefined,
      instructedByName: payload.instructedByName === undefined ? undefined : payload.instructedByName,
      variationCreatedAt,
      variationValue: payload.variationValue === undefined ? undefined : payload.variationValue
    }
  });

  return NextResponse.json({ variationItem });
}

export async function DELETE(request: Request, context: { params: { projectId: string; itemId: string } }) {
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

  const item = await prisma.variationItem.findFirst({ where: { id: itemId, projectId } });
  if (item?.storageKey) await deleteFromS3(item.storageKey).catch(() => {});
  if (item?.quoteStorageKey) await deleteFromS3(item.quoteStorageKey).catch(() => {});

  const [dayWorksSheets, photos, packages] = await Promise.all([
    prisma.dayWorksSheet.findMany({ where: { variationItemId: itemId } }),
    prisma.variationPhoto.findMany({ where: { variationItemId: itemId } }),
    prisma.variationPackage.findMany({ where: { variationItemId: itemId } })
  ]);
  await Promise.all([
    ...dayWorksSheets.map((sheet) => deleteFromS3(sheet.storageKey).catch(() => {})),
    ...photos.map((photo) => deleteFromS3(photo.storageKey).catch(() => {})),
    ...packages.map((pkg) => deleteFromS3(pkg.storageKey).catch(() => {}))
  ]);

  await prisma.dayWorksSheet.deleteMany({ where: { variationItemId: itemId } });
  await prisma.variationPhoto.deleteMany({ where: { variationItemId: itemId } });
  // Generated packages have no independent meaning once their source
  // VariationItem is gone (unlike Correspondence/Update below, which are
  // just detached) — deleted outright, matching the RESTRICT foreign key.
  await prisma.variationPackage.deleteMany({ where: { variationItemId: itemId } });
  await prisma.correspondence.updateMany({ where: { variationItemId: itemId }, data: { variationItemId: null } });
  await prisma.update.updateMany({ where: { variationItemId: itemId }, data: { variationItemId: null } });
  await prisma.variationItem.delete({ where: { id: itemId, projectId } });

  return NextResponse.json({ ok: true });
}
