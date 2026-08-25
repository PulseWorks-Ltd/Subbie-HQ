import { prisma } from "./prisma";
import { uploadToS3 } from "./s3";
import { generateVariationPackagePdf } from "./variation-package-pdf";
import { computePackageTotals, PACKAGE_CATEGORIES, type PackageCategory } from "./variation-package";
import type { VariationPackage } from "@prisma/client";

// The actual "generate a new immutable snapshot PDF from everything
// currently attached to this Variation/SI" work, factored out of
// app/api/projects/[projectId]/variation-items/[itemId]/packages/route.ts
// so the scheduling automation (lib/variation-schedule.ts) can generate a
// package the exact same way a person clicking "Generate" does — same
// queries, same PDF, same totals math, same VariationPackage row shape.
// That route now just calls this and stays a thin request/response wrapper.
export async function generateAndStoreVariationPackage(params: {
  projectId: string;
  itemId: string;
  generatedByUserId: string;
  includedCategories?: PackageCategory[];
}): Promise<VariationPackage | null> {
  const includedCategories = params.includedCategories ?? [...PACKAGE_CATEGORIES];
  const isIncluded = (category: PackageCategory) => includedCategories.includes(category);

  const [item, user] = await Promise.all([
    prisma.variationItem.findFirst({ where: { id: params.itemId, projectId: params.projectId } }),
    prisma.user.findUnique({ where: { id: params.generatedByUserId }, select: { firstName: true, lastName: true, email: true } })
  ]);
  if (!item) {
    return null;
  }

  const [photos, correspondence, dayWorksSheets, sheetRecords, materials, plant, updates, contractTerms] = await Promise.all([
    prisma.variationPhoto.findMany({ where: { variationItemId: params.itemId }, orderBy: { createdAt: "desc" } }),
    prisma.correspondence.findMany({
      where: { variationItemId: params.itemId },
      orderBy: { createdAt: "desc" },
      include: {
        inboundEmail: true,
        sourceUpdate: { include: { author: true, recipients: true } }
      }
    }),
    prisma.dayWorksSheet.findMany({ where: { variationItemId: params.itemId }, orderBy: { createdAt: "desc" } }),
    prisma.dayWorksSheetRecord.findMany({ where: { variationItemId: params.itemId }, orderBy: { sortOrder: "asc" } }),
    prisma.dayWorksMaterial.findMany({ where: { variationItemId: params.itemId }, orderBy: { createdAt: "asc" } }),
    prisma.dayWorksPlant.findMany({ where: { variationItemId: params.itemId }, orderBy: { createdAt: "asc" } }),
    prisma.update.findMany({
      where: { variationItemId: params.itemId },
      orderBy: { createdAt: "asc" },
      include: { author: true, attachments: true }
    }),
    prisma.contractTerms.findUnique({ where: { projectId: params.projectId } })
  ]);

  const generatedByName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "Unknown user";

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

  const uploadKey = `projects/${params.projectId}/variation-items/${params.itemId}/packages/${Date.now()}-variation-package-${item.reference}.pdf`;
  const { storageKey } = await uploadToS3({ key: uploadKey, body: pdfBytes, contentType: "application/pdf" });

  const totals = computePackageTotals(filteredSheetRecords, filteredMaterials, filteredPlant, contractTerms);

  return prisma.variationPackage.create({
    data: {
      variationItemId: params.itemId,
      generatedByUserId: params.generatedByUserId,
      fileName: `Variation Package - ${item.reference}.pdf`,
      storageKey,
      labourTotal: totals.labourTotal,
      materialsTotal: totals.materialsTotal,
      materialsMarkupTotal: totals.materialsMarkupTotal,
      plantTotal: totals.plantTotal,
      grandTotal: totals.grandTotal,
      photoCount: filteredPhotos.length,
      correspondenceCount: filteredCorrespondence.length,
      dayWorksSheetCount: filteredSheetRecords.length,
      includedCategories
    }
  });
}
