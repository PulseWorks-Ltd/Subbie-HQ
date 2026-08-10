import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { uploadToS3 } from "@/lib/s3";
import { generateVariationPackagePdf } from "@/lib/variation-package-pdf";
import { computePackageTotals, PACKAGE_CATEGORIES, type PackageCategory } from "@/lib/variation-package";

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
  const includedCategories: PackageCategory[] = parsed.data.includedCategories ?? [...PACKAGE_CATEGORIES];
  const isIncluded = (category: PackageCategory) => includedCategories.includes(category);

  const [item, user] = await Promise.all([
    prisma.variationItem.findFirst({ where: { id: itemId, projectId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, email: true } })
  ]);
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [photos, correspondence, dayWorksSheets, sheetRecords, materials, plant, updates, contractTerms] = await Promise.all([
    prisma.variationPhoto.findMany({ where: { variationItemId: itemId }, orderBy: { createdAt: "desc" } }),
    prisma.correspondence.findMany({
      where: { variationItemId: itemId },
      orderBy: { createdAt: "desc" },
      include: {
        inboundEmail: true,
        sourceUpdate: { include: { author: true, recipients: true } }
      }
    }),
    // Just the uploaded files — labour records are independent of any
    // sheet now too (Labour, Plant & Material AI Extraction, extended to
    // Labour), fetched at the item level below instead.
    prisma.dayWorksSheet.findMany({ where: { variationItemId: itemId }, orderBy: { createdAt: "desc" } }),
    prisma.dayWorksSheetRecord.findMany({ where: { variationItemId: itemId }, orderBy: { sortOrder: "asc" } }),
    prisma.dayWorksMaterial.findMany({ where: { variationItemId: itemId }, orderBy: { createdAt: "asc" } }),
    prisma.dayWorksPlant.findMany({ where: { variationItemId: itemId }, orderBy: { createdAt: "asc" } }),
    prisma.update.findMany({
      where: { variationItemId: itemId },
      orderBy: { createdAt: "asc" },
      include: { author: true, attachments: true }
    }),
    prisma.contractTerms.findUnique({ where: { projectId } })
  ]);

  const generatedByName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "Unknown user";

  // Filter here, once, rather than threading category checks through the
  // PDF generator — generateVariationPackagePdf already gates every
  // section on these same arrays'/item's fields being present, so an
  // excluded category simply becomes "zero items"/"no file" to every part
  // of the document (cover summary, computed totals, and the real-evidence
  // embed sections alike), with zero changes needed inside that function.
  const filteredPhotos = isIncluded("photos") ? photos : [];
  const filteredCorrespondence = isIncluded("correspondence") ? correspondence : [];
  const filteredDayWorksSheets = isIncluded("day_works_sheets") ? dayWorksSheets : [];
  const filteredSheetRecords = isIncluded("day_works_sheets") ? sheetRecords : [];
  const filteredMaterials = isIncluded("materials") ? materials : [];
  const filteredPlant = isIncluded("plant") ? plant : [];
  const filteredUpdates = isIncluded("linked_updates") ? updates : [];
  const filteredItem = {
    ...item,
    quoteFileName: isIncluded("quote") ? item.quoteFileName : null,
    quoteStorageKey: isIncluded("quote") ? item.quoteStorageKey : null,
    fileName: isIncluded("si_source_document") ? item.fileName : null,
    storageKey: isIncluded("si_source_document") ? item.storageKey : null
  };

  const pdfBytes = await generateVariationPackagePdf({
    item: filteredItem,
    photos: filteredPhotos,
    correspondence: filteredCorrespondence,
    dayWorksSheets: filteredDayWorksSheets,
    sheetRecords: filteredSheetRecords,
    materials: filteredMaterials,
    plant: filteredPlant,
    updates: filteredUpdates,
    contractTerms,
    generatedByName
  });

  const uploadKey = `projects/${projectId}/variation-items/${itemId}/packages/${Date.now()}-variation-package-${item.reference}.pdf`;
  const { storageKey } = await uploadToS3({ key: uploadKey, body: pdfBytes, contentType: "application/pdf" });

  const totals = computePackageTotals(filteredSheetRecords, filteredMaterials, filteredPlant, contractTerms);

  const variationPackage = await prisma.variationPackage.create({
    data: {
      variationItemId: itemId,
      generatedByUserId: userId,
      fileName: `Variation Package - ${item.reference}.pdf`,
      storageKey,
      labourTotal: totals.labourTotal,
      materialsTotal: totals.materialsTotal,
      materialsMarkupTotal: totals.materialsMarkupTotal,
      plantTotal: totals.plantTotal,
      grandTotal: totals.grandTotal,
      photoCount: filteredPhotos.length,
      correspondenceCount: filteredCorrespondence.length,
      // Records, not files — matches Materials/Plant counting line items
      // (Task: visual/functional consistency, now that Labour is
      // independent of any sheet too).
      dayWorksSheetCount: filteredSheetRecords.length,
      includedCategories
    }
  });

  return NextResponse.json({ variationPackage }, { status: 201 });
}
