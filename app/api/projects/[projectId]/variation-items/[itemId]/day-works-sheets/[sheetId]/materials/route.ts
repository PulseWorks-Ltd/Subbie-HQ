import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { uploadToS3 } from "@/lib/s3";

async function moduleForItem(projectId: string, itemId: string) {
  const item = await prisma.variationItem.findFirst({ where: { id: itemId, projectId }, select: { type: true } });
  if (!item) return null;
  return item.type === "variation" ? ("variations" as const) : ("site_instructions" as const);
}

// One material line item per request — no markup applied, this records
// raw cost only (see task rules). The optional "photo" file is uploaded
// in the same request as the line item's own fields, matching the
// day-works-sheets upload's single-step pattern rather than a separate
// follow-up call.
export async function POST(
  request: Request,
  context: { params: { projectId: string; itemId: string; sheetId: string } }
) {
  const userId = await requireUserId(request);
  const { projectId, itemId, sheetId } = context.params;
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

  const sheet = await prisma.dayWorksSheet.findFirst({ where: { id: sheetId, variationItemId: itemId } });
  if (!sheet) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const description = formData.get("description")?.toString().trim();
  const quantity = Number(formData.get("quantity"));
  const unit = formData.get("unit")?.toString().trim();
  const unitCost = Number(formData.get("unitCost"));

  if (!description || !unit || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitCost) || unitCost < 0) {
    return NextResponse.json({ error: "Description, quantity, unit, and unit cost are required." }, { status: 400 });
  }

  let photoFileName: string | null = null;
  let photoStorageKey: string | null = null;
  let photoContentType: string | null = null;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (!photo.type.startsWith("image/")) {
      return NextResponse.json({ error: "The receipt attachment must be an image." }, { status: 400 });
    }
    const buffer = new Uint8Array(await photo.arrayBuffer());
    const uploadKey = `projects/${projectId}/variation-items/${itemId}/day-works/${sheetId}/materials/${Date.now()}-${photo.name}`;
    const { storageKey } = await uploadToS3({ key: uploadKey, body: buffer, contentType: photo.type });
    photoFileName = photo.name;
    photoStorageKey = storageKey;
    photoContentType = photo.type;
  }

  const material = await prisma.dayWorksMaterial.create({
    data: {
      dayWorksSheetId: sheetId,
      description,
      quantity,
      unit,
      unitCost,
      photoFileName,
      photoStorageKey,
      photoContentType
    }
  });

  return NextResponse.json({ material }, { status: 201 });
}
