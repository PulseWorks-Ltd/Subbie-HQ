import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { uploadToS3 } from "@/lib/s3";
import { ALLOWED_IMAGE_TYPES, MAX_ATTACHMENT_SIZE_BYTES, isAllowedImageType } from "@/lib/update-attachments";

async function moduleForItem(projectId: string, itemId: string) {
  const item = await prisma.variationItem.findFirst({ where: { id: itemId, projectId }, select: { type: true } });
  if (!item) return null;
  return item.type === "variation" ? ("variations" as const) : ("site_instructions" as const);
}

// Mirrors materials/route.ts exactly (same fields, same S3 photo-
// attachment pattern) — the only difference is which model it writes to
// and that this line item never receives materials markup (Task 1.1).
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
    if (!isAllowedImageType(photo.type)) {
      return NextResponse.json({ error: `The docket attachment must be a ${ALLOWED_IMAGE_TYPES.join(" or ")} image.` }, { status: 400 });
    }
    if (photo.size > MAX_ATTACHMENT_SIZE_BYTES) {
      return NextResponse.json({ error: "The docket attachment must be 20MB or smaller." }, { status: 400 });
    }
    const buffer = new Uint8Array(await photo.arrayBuffer());
    const uploadKey = `projects/${projectId}/variation-items/${itemId}/plant/${Date.now()}-${photo.name}`;
    const { storageKey } = await uploadToS3({ key: uploadKey, body: buffer, contentType: photo.type });
    photoFileName = photo.name;
    photoStorageKey = storageKey;
    photoContentType = photo.type;
  }

  const plantItem = await prisma.dayWorksPlant.create({
    data: {
      variationItemId: itemId,
      description,
      quantity,
      unit,
      unitCost,
      photoFileName,
      photoStorageKey,
      photoContentType
    }
  });

  return NextResponse.json({ plant: plantItem }, { status: 201 });
}
