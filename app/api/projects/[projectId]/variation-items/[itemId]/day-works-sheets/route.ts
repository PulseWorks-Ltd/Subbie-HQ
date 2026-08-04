import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { downloadFromS3, uploadToS3 } from "@/lib/s3";

async function moduleForItem(projectId: string, itemId: string) {
  const item = await prisma.variationItem.findFirst({ where: { id: itemId, projectId }, select: { type: true } });
  if (!item) return null;
  return item.type === "variation" ? ("variations" as const) : ("site_instructions" as const);
}

export async function GET(request: Request, context: { params: { projectId: string; itemId: string } }) {
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

  const dayWorksSheets = await prisma.dayWorksSheet.findMany({
    where: { variationItemId: itemId },
    orderBy: { createdAt: "desc" },
    include: {
      materials: { orderBy: { createdAt: "asc" } },
      plant: { orderBy: { createdAt: "asc" } },
      sheetRecords: { orderBy: { sortOrder: "asc" } }
    }
  });

  return NextResponse.json({ dayWorksSheets });
}

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

  // Two input paths, same end result (a new DayWorksSheet row pointing at
  // its own S3 object): a fresh multipart upload (existing "+Upload"
  // button), or a JSON reference to an image that's already stored
  // elsewhere in this project (the "Use as Day Works Sheet" action on an
  // Update attachment or a Pictures-tab photo — see
  // components/day-works/use-as-day-works-sheet-action.tsx). The second
  // path always copies the bytes to a brand-new key rather than reusing
  // the source's storageKey — this DayWorksSheet's own DELETE route
  // deletes its storageKey from S3, which would otherwise silently wipe
  // out the original Update attachment/Picture out from under it.
  const contentTypeHeader = request.headers.get("content-type") ?? "";

  if (contentTypeHeader.includes("application/json")) {
    const payload = await request.json().catch(() => null);
    const source = payload?.source;
    if (
      !source ||
      (source.type !== "update-attachment" && source.type !== "variation-photo") ||
      typeof source.id !== "string"
    ) {
      return NextResponse.json({ error: "Invalid source reference" }, { status: 400 });
    }

    const sourceRecord =
      source.type === "update-attachment"
        ? await prisma.updateAttachment.findFirst({ where: { id: source.id, update: { projectId } } })
        : await prisma.variationPhoto.findFirst({ where: { id: source.id, variationItem: { projectId } } });

    if (!sourceRecord) {
      return NextResponse.json({ error: "Source image not found" }, { status: 404 });
    }

    const buffer = await downloadFromS3(sourceRecord.storageKey);
    const uploadKey = `projects/${projectId}/variation-items/${itemId}/day-works/${Date.now()}-${sourceRecord.fileName}`;
    const contentType = sourceRecord.contentType || "application/octet-stream";
    const { storageKey } = await uploadToS3({ key: uploadKey, body: buffer, contentType });

    const dayWorksSheet = await prisma.dayWorksSheet.create({
      data: { variationItemId: itemId, fileName: sourceRecord.fileName, storageKey, contentType }
    });

    return NextResponse.json({ dayWorksSheet }, { status: 201 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const uploadKey = `projects/${projectId}/variation-items/${itemId}/day-works/${Date.now()}-${file.name}`;
  const contentType = file.type || "application/octet-stream";
  const { storageKey } = await uploadToS3({ key: uploadKey, body: buffer, contentType });

  const dayWorksSheet = await prisma.dayWorksSheet.create({
    data: { variationItemId: itemId, fileName: file.name, storageKey, contentType }
  });

  return NextResponse.json({ dayWorksSheet }, { status: 201 });
}
