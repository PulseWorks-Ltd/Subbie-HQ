import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId, getProjectMemberUserIdsWithModuleAccess } from "@/lib/auth";
import { sendPushToUser } from "@/lib/push";
import { sendReplyNotificationEmail } from "@/lib/email";
import { uploadToS3 } from "@/lib/s3";
import { sendExternalUpdateAndLog } from "@/lib/external-update";
import { formatUserName } from "@/lib/user-display";
import { MAX_ATTACHMENTS, MAX_ATTACHMENT_SIZE_BYTES, isAllowedAttachmentType, attachmentKind } from "@/lib/update-attachments";
import { generateThumbnail } from "@/lib/image-thumbnails";

const recipientSchema = z
  .object({
    contactId: z.string().optional(),
    email: z.string().email().optional()
  })
  .refine((r) => r.contactId || r.email, { message: "Each recipient needs either a saved contact or an email address." });

const createUpdateSchema = z.object({
  body: z.string().min(1),
  parentId: z.string().optional(),
  variationItemId: z.string().optional(),
  percentComplete: z.number().min(0).max(100).optional(),
  isExternal: z.boolean().default(false),
  externalSubject: z.string().optional(),
  externalBody: z.string().optional(),
  recipients: z.array(recipientSchema).default([])
});

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

  const canAccessModule = await requireModuleAccess(projectId, userId, "updates");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updates = await prisma.update.findMany({
    where: { projectId, parentId: null },
    include: {
      author: { select: { id: true, firstName: true, lastName: true, email: true } },
      variationItem: { select: { id: true, reference: true, title: true } },
      qaRecord: { select: { id: true, stage: true } },
      attachments: true,
      recipients: true,
      replies: {
        include: {
          author: { select: { id: true, firstName: true, lastName: true, email: true } },
          attachments: true
        },
        orderBy: { createdAt: "asc" }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ updates });
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

  const canAccessModule = await requireModuleAccess(projectId, userId, "updates");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const percentCompleteRaw = formData.get("percentComplete");
  const recipientsRaw = formData.get("recipients")?.toString();
  const payload = createUpdateSchema.parse({
    body: formData.get("body"),
    parentId: formData.get("parentId") || undefined,
    variationItemId: formData.get("variationItemId") || undefined,
    percentComplete: percentCompleteRaw ? Number(percentCompleteRaw) : undefined,
    isExternal: formData.get("isExternal") === "true",
    externalSubject: formData.get("externalSubject")?.toString() || undefined,
    externalBody: formData.get("externalBody")?.toString() || undefined,
    recipients: recipientsRaw ? JSON.parse(recipientsRaw) : []
  });

  const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (files.length > MAX_ATTACHMENTS) {
    return NextResponse.json({ error: `You can attach up to ${MAX_ATTACHMENTS} files.` }, { status: 400 });
  }
  if (files.some((file) => !isAllowedAttachmentType(file.type))) {
    return NextResponse.json(
      { error: "Attachments must be an image, PDF, or DOCX file." },
      { status: 400 }
    );
  }
  if (files.some((file) => file.size > MAX_ATTACHMENT_SIZE_BYTES)) {
    return NextResponse.json(
      { error: `Each attachment must be under ${Math.floor(MAX_ATTACHMENT_SIZE_BYTES / (1024 * 1024))}MB.` },
      { status: 400 }
    );
  }

  let parent = null;
  if (payload.parentId) {
    parent = await prisma.update.findFirst({
      where: { id: payload.parentId, projectId, parentId: null },
      include: { author: { select: { id: true, email: true } } }
    });
    if (!parent) {
      return NextResponse.json({ error: "Parent update not found" }, { status: 400 });
    }
  }

  let variationItem = null;
  if (payload.variationItemId) {
    variationItem = await prisma.variationItem.findFirst({
      where: { id: payload.variationItemId, projectId }
    });
    if (!variationItem) {
      return NextResponse.json({ error: "Variation/Site Instruction not found" }, { status: 400 });
    }
  }

  // External updates are a one-way email notification, not part of the
  // internal reply thread — validated up front so a bad recipient doesn't
  // create a half-finished update. Contact-based recipients are resolved to
  // their CURRENT email server-side (never trusting a client-supplied email
  // for a saved contact) — one-off recipients use the typed email as-is.
  let resolvedRecipients: { contactId?: string; email: string }[] = [];
  if (payload.isExternal && !payload.parentId) {
    if (!payload.externalSubject?.trim() || !payload.externalBody?.trim()) {
      return NextResponse.json({ error: "Draft the email before sending an external update." }, { status: 400 });
    }
    if (payload.recipients.length === 0) {
      return NextResponse.json({ error: "Select at least one recipient for an external update." }, { status: 400 });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { mainContractorId: true } });
    const contactIds = payload.recipients.map((r) => r.contactId).filter((id): id is string => Boolean(id));
    const contacts = contactIds.length
      ? await prisma.mainContractorContact.findMany({
          where: { id: { in: contactIds }, mainContractorId: project?.mainContractorId ?? undefined }
        })
      : [];
    const contactsById = new Map(contacts.map((c) => [c.id, c]));

    for (const recipient of payload.recipients) {
      if (recipient.contactId) {
        const contact = contactsById.get(recipient.contactId);
        if (!contact?.email) {
          return NextResponse.json({ error: "One of the selected contacts has no email on file." }, { status: 400 });
        }
        resolvedRecipients.push({ contactId: contact.id, email: contact.email });
      } else if (recipient.email) {
        resolvedRecipients.push({ email: recipient.email });
      }
    }
  }

  const isExternal = payload.isExternal && !payload.parentId && resolvedRecipients.length > 0;

  const update = await prisma.update.create({
    data: {
      projectId,
      authorId: userId,
      parentId: payload.parentId,
      // Replies inherit their parent thread's tagged item rather than carrying their own.
      variationItemId: payload.parentId ? undefined : payload.variationItemId,
      percentComplete: payload.parentId ? undefined : payload.percentComplete,
      body: payload.body,
      isExternal,
      externalSubject: isExternal ? payload.externalSubject : undefined,
      externalBody: isExternal ? payload.externalBody : undefined,
      recipients: isExternal ? { create: resolvedRecipients.map((r) => ({ mainContractorContactId: r.contactId, email: r.email })) } : undefined
    },
    include: {
      author: { select: { id: true, firstName: true, lastName: true, email: true } },
      variationItem: { select: { id: true, reference: true, title: true } },
      recipients: true
    }
  });

  // The author has obviously "read" what they just wrote — without this,
  // every update they post would immediately show up as unread in their own
  // Dashboard Updates section.
  await prisma.updateRead.create({ data: { userId, updateId: update.id } });

  // Applying a tagged % complete depends on the organisation's completion-update
  // setting: auto-apply straight to percentComplete, or park it as a suggestion
  // pending Admin/PM confirmation. Projects with no organisation (legacy/personal)
  // default to auto, consistent with how every other org-gated behavior in this
  // app treats org-less projects as unrestricted.
  if (variationItem && payload.percentComplete !== undefined && !payload.parentId) {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { organisationId: true } });
    const organisation = project?.organisationId
      ? await prisma.organisation.findUnique({ where: { id: project.organisationId }, select: { variationCompletionMode: true } })
      : null;

    if (organisation?.variationCompletionMode === "requires_confirmation") {
      await prisma.variationItem.update({
        where: { id: variationItem.id },
        data: { suggestedPercentComplete: payload.percentComplete }
      });
    } else {
      await prisma.variationItem.update({
        where: { id: variationItem.id },
        data: { percentComplete: payload.percentComplete }
      });
    }
  }

  for (const file of files) {
    const buffer = new Uint8Array(await file.arrayBuffer());
    const uploadKey = `projects/${projectId}/updates/${update.id}/${Date.now()}-${file.name}`;
    const { storageKey } = await uploadToS3({ key: uploadKey, body: buffer, contentType: file.type });

    // Best-effort — a thumbnail failing to generate (e.g. a genuinely
    // corrupt image sharp can't decode) must never block the actual
    // attachment upload. thumbnailStorageKey just stays null and the file
    // route falls back to serving the original for display too.
    let thumbnailStorageKey: string | null = null;
    if (attachmentKind(file.type) === "image") {
      try {
        const thumbnailBuffer = await generateThumbnail(buffer);
        const thumbnailKey = `projects/${projectId}/updates/${update.id}/thumb-${Date.now()}-${file.name}.jpg`;
        const thumbnailUpload = await uploadToS3({ key: thumbnailKey, body: thumbnailBuffer, contentType: "image/jpeg" });
        thumbnailStorageKey = thumbnailUpload.storageKey;
      } catch {
        // fall through with thumbnailStorageKey left null
      }
    }

    await prisma.updateAttachment.create({
      data: { updateId: update.id, fileName: file.name, storageKey, contentType: file.type, thumbnailStorageKey }
    });
  }

  const attachments = await prisma.updateAttachment.findMany({ where: { updateId: update.id } });

  let sendError: string | undefined;
  if (isExternal) {
    const result = await sendExternalUpdateAndLog(update.id);
    if (!result.ok) sendError = result.error;
  }

  const notifiedUserIds = new Set<string>([userId]);

  if (parent && parent.authorId !== userId) {
    const authorLabel = formatUserName(update.author) ?? update.author.email;
    const mobileUrl = `/m/${projectId}?update=${parent.id}`;

    await sendPushToUser(parent.authorId, {
      title: `${authorLabel} replied`,
      body: payload.body.slice(0, 140),
      url: mobileUrl
    }).catch(() => {});
    notifiedUserIds.add(parent.authorId);

    if (parent.author.email) {
      const project = await prisma.project.findUnique({ where: { id: projectId }, select: { name: true } });
      await sendReplyNotificationEmail({
        to: parent.author.email,
        authorName: authorLabel,
        projectName: project?.name ?? "your project",
        updateBody: payload.body,
        updateUrl: `${process.env.AUTH_URL ?? ""}${mobileUrl}`
      }).catch(() => {});
    }
  }

  // Broadcast to everyone else with visibility into this project's Updates
  // — a new top-level update (or a reply) is relevant to the whole team,
  // not just a reply's direct parent author (who's already been notified
  // more specifically above, so isn't double-notified here). Deep-links to
  // this specific update, not just the project's update list.
  const authorLabel = formatUserName(update.author) ?? update.author.email;
  const memberIds = await getProjectMemberUserIdsWithModuleAccess(projectId, "updates");
  const targetUpdateId = payload.parentId ?? update.id;
  const deepLinkUrl = `/m/${projectId}?update=${targetUpdateId}`;
  await Promise.all(
    memberIds
      .filter((id) => !notifiedUserIds.has(id))
      .map((id) =>
        sendPushToUser(id, {
          title: `${authorLabel} posted an update`,
          body: payload.body.slice(0, 140),
          url: deepLinkUrl
        }).catch(() => {})
      )
  );

  return NextResponse.json({ update: { ...update, attachments }, sendError }, { status: 201 });
}
