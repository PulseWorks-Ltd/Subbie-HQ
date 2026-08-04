import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { uploadToS3 } from "@/lib/s3";
import { generateVariationPackagePdf } from "@/lib/variation-package-pdf";
import { computePackageTotals } from "@/lib/variation-package";

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

  const [item, user] = await Promise.all([
    prisma.variationItem.findFirst({ where: { id: itemId, projectId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, email: true } })
  ]);
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [photos, correspondence, dayWorksSheets, updates, contractTerms] = await Promise.all([
    prisma.variationPhoto.findMany({ where: { variationItemId: itemId }, orderBy: { createdAt: "desc" } }),
    prisma.correspondence.findMany({
      where: { variationItemId: itemId },
      orderBy: { createdAt: "desc" },
      include: {
        inboundEmail: true,
        sourceUpdate: { include: { author: true, recipients: true } }
      }
    }),
    prisma.dayWorksSheet.findMany({
      where: { variationItemId: itemId },
      orderBy: { createdAt: "desc" },
      include: {
        materials: { orderBy: { createdAt: "asc" } },
        plant: { orderBy: { createdAt: "asc" } },
        sheetRecords: { orderBy: { sortOrder: "asc" } }
      }
    }),
    prisma.update.findMany({
      where: { variationItemId: itemId },
      orderBy: { createdAt: "asc" },
      include: { author: true, attachments: true }
    }),
    prisma.contractTerms.findUnique({ where: { projectId } })
  ]);

  const generatedByName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "Unknown user";

  const pdfBytes = await generateVariationPackagePdf({
    item,
    photos,
    correspondence,
    dayWorksSheets,
    updates,
    contractTerms,
    generatedByName
  });

  const uploadKey = `projects/${projectId}/variation-items/${itemId}/packages/${Date.now()}-variation-package-${item.reference}.pdf`;
  const { storageKey } = await uploadToS3({ key: uploadKey, body: pdfBytes, contentType: "application/pdf" });

  const totals = computePackageTotals(dayWorksSheets, contractTerms);

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
      photoCount: photos.length,
      correspondenceCount: correspondence.length,
      dayWorksSheetCount: dayWorksSheets.length
    }
  });

  return NextResponse.json({ variationPackage }, { status: 201 });
}
