import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, requireUserId } from "@/lib/auth";
import { sendPushToUser } from "@/lib/push";
import { sendReplyNotificationEmail } from "@/lib/email";
import { uploadToS3 } from "@/lib/s3";

const MAX_ATTACHMENTS = 4;

const createUpdateSchema = z.object({
  body: z.string().min(1),
  parentId: z.string().optional(),
  siteInstructionId: z.string().optional()
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

  const updates = await prisma.update.findMany({
    where: { projectId, parentId: null },
    include: {
      author: { select: { id: true, name: true, email: true } },
      siteInstruction: { select: { id: true, reference: true, title: true } },
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

  const formData = await request.formData();
  const payload = createUpdateSchema.parse({
    body: formData.get("body"),
    parentId: formData.get("parentId") || undefined,
    siteInstructionId: formData.get("siteInstructionId") || undefined
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

  if (payload.siteInstructionId) {
    const siteInstruction = await prisma.siteInstruction.findFirst({
      where: { id: payload.siteInstructionId, projectId }
    });
    if (!siteInstruction) {
      return NextResponse.json({ error: "Site instruction not found" }, { status: 400 });
    }
  }

  const update = await prisma.update.create({
    data: {
      projectId,
      authorId: userId,
      parentId: payload.parentId,
      // Replies inherit their parent thread's site instruction context rather than carrying their own.
      siteInstructionId: payload.parentId ? undefined : payload.siteInstructionId,
      body: payload.body
    },
    include: {
      author: { select: { id: true, name: true, email: true } },
      siteInstruction: { select: { id: true, reference: true, title: true } }
    }
  });

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
