import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { downloadFromS3, uploadToS3 } from "@/lib/s3";

export async function GET(request: Request, context: { params: { projectId: string } }) {
  const userId = await requireUserId(request);
  const { projectId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const canAccessModule = await requireModuleAccess(projectId, userId, "quality_assurance");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const qaRecords = await prisma.qARecord.findMany({
    where: { projectId },
    include: { variationItem: { select: { id: true, reference: true, title: true } } },
    orderBy: { date: "desc" }
  });

  return NextResponse.json({ qaRecords });
}

export async function POST(request: Request, context: { params: { projectId: string } }) {
  const userId = await requireUserId(request);
  const { projectId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const canAccessModule = await requireModuleAccess(projectId, userId, "quality_assurance");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  async function resolveVariationItemId(rawId: string | null | undefined): Promise<string | null | { error: string }> {
    if (!rawId) return null;
    const item = await prisma.variationItem.findFirst({ where: { id: rawId, projectId }, select: { id: true } });
    if (!item) return { error: "Variation/Site Instruction not found on this project." };
    return item.id;
  }

  // Two input paths, same end result (a new QARecord row): a fresh
  // multipart upload (manual entry, from the QA tab or an item's page), or
  // a JSON reference to an image/file already stored elsewhere in this
  // project (the "Use as QA Record" action — see
  // components/quality-assurance/use-as-qa-record-action.tsx). The second
  // path always copies the bytes to a brand-new key rather than reusing the
  // source's storageKey — this QARecord's own DELETE route deletes its
  // storageKey from S3, which would otherwise silently wipe out the
  // original Update attachment/Picture out from under it (same reasoning
  // as day-works-sheets/route.ts).
  const contentTypeHeader = request.headers.get("content-type") ?? "";

  if (contentTypeHeader.includes("application/json")) {
    const payload = await request.json().catch(() => null);
    const source = payload?.source;
    const stage = typeof payload?.stage === "string" ? payload.stage.trim() : "";
    const notes = typeof payload?.notes === "string" ? payload.notes.trim() : "";

    if (!stage) {
      return NextResponse.json({ error: "Stage/milestone label is required" }, { status: 400 });
    }
    if (
      !source ||
      (source.type !== "update-attachment" && source.type !== "variation-photo") ||
      typeof source.id !== "string"
    ) {
      return NextResponse.json({ error: "Invalid source reference" }, { status: 400 });
    }

    const variationItemId = await resolveVariationItemId(payload?.variationItemId);
    if (variationItemId && typeof variationItemId === "object") {
      return NextResponse.json({ error: variationItemId.error }, { status: 400 });
    }

    const sourceRecord =
      source.type === "update-attachment"
        ? await prisma.updateAttachment.findFirst({ where: { id: source.id, update: { projectId } } })
        : await prisma.variationPhoto.findFirst({ where: { id: source.id, variationItem: { projectId } } });

    if (!sourceRecord) {
      return NextResponse.json({ error: "Source file not found" }, { status: 404 });
    }

    const buffer = await downloadFromS3(sourceRecord.storageKey);
    const uploadKey = `projects/${projectId}/qa-records/${Date.now()}-${sourceRecord.fileName}`;
    const contentType = sourceRecord.contentType || "application/octet-stream";
    const { storageKey } = await uploadToS3({ key: uploadKey, body: buffer, contentType });

    const qaRecord = await prisma.qARecord.create({
      data: {
        projectId,
        variationItemId,
        stage,
        notes: notes || undefined,
        fileName: sourceRecord.fileName,
        storageKey
      }
    });

    return NextResponse.json({ qaRecord }, { status: 201 });
  }

  const formData = await request.formData();
  const stage = formData.get("stage")?.toString().trim();
  const notes = formData.get("notes")?.toString().trim();
  const date = formData.get("date")?.toString();
  const variationItemIdRaw = formData.get("variationItemId")?.toString();
  const file = formData.get("file");

  if (!stage) {
    return NextResponse.json({ error: "Stage/milestone label is required" }, { status: 400 });
  }

  const variationItemId = await resolveVariationItemId(variationItemIdRaw);
  if (variationItemId && typeof variationItemId === "object") {
    return NextResponse.json({ error: variationItemId.error }, { status: 400 });
  }

  let fileName: string | undefined;
  let storageKey: string | undefined;
  if (file instanceof File && file.size > 0) {
    const buffer = new Uint8Array(await file.arrayBuffer());
    const uploadKey = `projects/${projectId}/qa-records/${Date.now()}-${file.name}`;
    const uploaded = await uploadToS3({ key: uploadKey, body: buffer, contentType: file.type || "application/octet-stream" });
    fileName = file.name;
    storageKey = uploaded.storageKey;
  }

  const qaRecord = await prisma.qARecord.create({
    data: {
      projectId,
      variationItemId,
      stage,
      notes: notes || undefined,
      date: date ? new Date(date) : undefined,
      fileName,
      storageKey
    }
  });

  return NextResponse.json({ qaRecord }, { status: 201 });
}
