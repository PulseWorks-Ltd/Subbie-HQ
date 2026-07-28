import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { sendPushToUser } from "@/lib/push";
import { sendReplyNotificationEmail } from "@/lib/email";
import { uploadToS3 } from "@/lib/s3";

const MAX_ATTACHMENTS = 4;

const createUpdateSchema = z.object({
  body: z.string().min(1),
  parentId: z.string().optional(),
  variationItemId: z.string().optional(),
  percentComplete: z.number().min(0).max(100).optional()
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
      author: { select: { id: true, name: true, email: true } },
      variationItem: { select: { id: true, reference: true, title: true } },
      attachments: true,
      replies: {
        include: {
          author: { select: { id: true, name: true, email: true } },
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
  const payload = createUpdateSchema.parse({
    body: formData.get("body"),
    parentId: formData.get("parentId") || undefined,
    variationItemId: formData.get("variationItemId") || undefined,
    percentComplete: percentCompleteRaw ? Number(percentCompleteRaw) : undefined
  });

  const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (files.length > MAX_ATTACHMENTS) {
    return NextResponse.json({ error: `You can attach up to ${MAX_ATTACHMENTS} photos.` }, { status: 400 });
  }
  if (files.some((file) => !file.type.startsWith("image/"))) {
    return NextResponse.json({ error: "Only image files can be attached." }, { status: 400 });
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

  const update = await prisma.update.create({
    data: {
      projectId,
      authorId: userId,
      parentId: payload.parentId,
      // Replies inherit their parent thread's tagged item rather than carrying their own.
      variationItemId: payload.parentId ? undefined : payload.variationItemId,
      percentComplete: payload.parentId ? undefined : payload.percentComplete,
      body: payload.body
    },
    include: {
      author: { select: { id: true, name: true, email: true } },
      variationItem: { select: { id: true, reference: true, title: true } }
    }
  });

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
    await prisma.updateAttachment.create({
      data: { updateId: update.id, fileName: file.name, storageKey, contentType: file.type }
    });
  }

  const attachments = await prisma.updateAttachment.findMany({ where: { updateId: update.id } });

  if (parent && parent.authorId !== userId) {
    const authorLabel = update.author.name ?? update.author.email;
    const mobileUrl = `/m/${projectId}`;

    await sendPushToUser(parent.authorId, {
      title: `${authorLabel} replied`,
      body: payload.body.slice(0, 140),
      url: mobileUrl
    }).catch(() => {});

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

  return NextResponse.json({ update: { ...update, attachments } }, { status: 201 });
}
