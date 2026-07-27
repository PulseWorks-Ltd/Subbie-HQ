import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, requireUserId } from "@/lib/auth";
import { sendPushToUser } from "@/lib/push";

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
      replies: {
        include: { author: { select: { id: true, name: true, email: true } } },
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

  const payload = createUpdateSchema.parse(await request.json());

  let parent = null;
  if (payload.parentId) {
    parent = await prisma.update.findFirst({
      where: { id: payload.parentId, projectId, parentId: null }
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

  if (parent && parent.authorId !== userId) {
    await sendPushToUser(parent.authorId, {
      title: `${update.author.name ?? update.author.email} replied`,
      body: payload.body.slice(0, 140),
      url: `/m/${projectId}`
    }).catch(() => {});
  }

  return NextResponse.json({ update }, { status: 201 });
}
