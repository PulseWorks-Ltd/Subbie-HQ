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
    include: {
      variationItem: { select: { id: true, reference: true, title: true } },
      attachments: true
    },
    orderBy: { date: "desc" }
  });

  return NextResponse.json({ qaRecords });
}

async function copyToQaRecordAttachment(
  projectId: string,
  qaRecordId: string,
  source: { fileName: string; storageKey: string; contentType: string | null }
) {
  const buffer = await downloadFromS3(source.storageKey);
  const uploadKey = `projects/${projectId}/qa-records/${Date.now()}-${Math.random().toString(36).slice(2)}-${source.fileName}`;
  const contentType = source.contentType || "application/octet-stream";
  const { storageKey } = await uploadToS3({ key: uploadKey, body: buffer, contentType });
  return prisma.qARecordAttachment.create({
    data: { qaRecordId, fileName: source.fileName, storageKey, contentType }
  });
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

  // Three input paths, same end result (a new QARecord with one or more
  // QARecordAttachment rows, non-destructive — nothing about the source is
  // ever moved or deleted):
  //  1. A fresh multipart upload (manual entry, from the QA tab or an
  //     item's page) — may include several `files`.
  //  2. A JSON reference to a single existing image/file elsewhere in this
  //     project ("Use as QA Record" on one Update attachment or Pictures
  //     item — components/quality-assurance/use-as-qa-record-action.tsx).
  //  3. A JSON reference to a whole Update ("Assign QA" in the Update's tag
  //     dropdown — components/quality-assurance/assign-update-as-qa-dialog.tsx):
  //     every attachment on that Update becomes its own QARecordAttachment,
  //     and the Update itself gets tagged (qaRecordId set, variationItemId
  //     cleared — mutually exclusive, see schema comment on Update).
  // Every copy re-uploads bytes to a brand-new key rather than reusing the
  // source's storageKey — this record's own DELETE route deletes every
  // attachment's storageKey from S3, which would otherwise silently wipe
  // out the original Update attachment/Picture out from under it.
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
      (source.type !== "update-attachment" && source.type !== "variation-photo" && source.type !== "update") ||
      typeof source.id !== "string"
    ) {
      return NextResponse.json({ error: "Invalid source reference" }, { status: 400 });
    }

    const variationItemId = await resolveVariationItemId(payload?.variationItemId);
    if (variationItemId && typeof variationItemId === "object") {
      return NextResponse.json({ error: variationItemId.error }, { status: 400 });
    }

    if (source.type === "update") {
      const sourceUpdate = await prisma.update.findFirst({
        where: { id: source.id, projectId, parentId: null },
        include: { attachments: true }
      });
      if (!sourceUpdate) {
        return NextResponse.json({ error: "Update not found" }, { status: 404 });
      }

      const qaRecord = await prisma.qARecord.create({
        data: { projectId, variationItemId, stage, notes: notes || undefined }
      });
      for (const attachment of sourceUpdate.attachments) {
        await copyToQaRecordAttachment(projectId, qaRecord.id, attachment);
      }
      await prisma.update.update({
        where: { id: sourceUpdate.id },
        data: { qaRecordId: qaRecord.id, variationItemId: null }
      });

      const withAttachments = await prisma.qARecord.findUnique({
        where: { id: qaRecord.id },
        include: { attachments: true, variationItem: { select: { id: true, reference: true, title: true } } }
      });
      return NextResponse.json({ qaRecord: withAttachments }, { status: 201 });
    }

    const sourceRecord =
      source.type === "update-attachment"
        ? await prisma.updateAttachment.findFirst({ where: { id: source.id, update: { projectId } } })
        : await prisma.variationPhoto.findFirst({ where: { id: source.id, variationItem: { projectId } } });

    if (!sourceRecord) {
      return NextResponse.json({ error: "Source file not found" }, { status: 404 });
    }

    const qaRecord = await prisma.qARecord.create({
      data: { projectId, variationItemId, stage, notes: notes || undefined }
    });
    await copyToQaRecordAttachment(projectId, qaRecord.id, sourceRecord);

    const withAttachments = await prisma.qARecord.findUnique({
      where: { id: qaRecord.id },
      include: { attachments: true, variationItem: { select: { id: true, reference: true, title: true } } }
    });
    return NextResponse.json({ qaRecord: withAttachments }, { status: 201 });
  }

  const formData = await request.formData();
  const stage = formData.get("stage")?.toString().trim();
  const notes = formData.get("notes")?.toString().trim();
  const date = formData.get("date")?.toString();
  const variationItemIdRaw = formData.get("variationItemId")?.toString();
  const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (!stage) {
    return NextResponse.json({ error: "Stage/milestone label is required" }, { status: 400 });
  }

  const variationItemId = await resolveVariationItemId(variationItemIdRaw);
  if (variationItemId && typeof variationItemId === "object") {
    return NextResponse.json({ error: variationItemId.error }, { status: 400 });
  }

  const qaRecord = await prisma.qARecord.create({
    data: {
      projectId,
      variationItemId,
      stage,
      notes: notes || undefined,
      date: date ? new Date(date) : undefined
    }
  });

  for (const file of files) {
    const buffer = new Uint8Array(await file.arrayBuffer());
    const uploadKey = `projects/${projectId}/qa-records/${Date.now()}-${file.name}`;
    const uploaded = await uploadToS3({ key: uploadKey, body: buffer, contentType: file.type || "application/octet-stream" });
    await prisma.qARecordAttachment.create({
      data: { qaRecordId: qaRecord.id, fileName: file.name, storageKey: uploaded.storageKey, contentType: file.type || undefined }
    });
  }

  const withAttachments = await prisma.qARecord.findUnique({
    where: { id: qaRecord.id },
    include: { attachments: true, variationItem: { select: { id: true, reference: true, title: true } } }
  });
  return NextResponse.json({ qaRecord: withAttachments }, { status: 201 });
}
