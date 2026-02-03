import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, requireUserId } from "@/lib/auth";

const createEmailSchema = z.object({
  sender: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
  attachments: z
    .array(
      z.object({
        fileName: z.string(),
        fileUrl: z.string(),
        storageKey: z.string()
      })
    )
    .optional()
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

  const emails = await prisma.inboundEmail.findMany({
    where: { projectId },
    include: { evidence: true },
    orderBy: { receivedAt: "desc" }
  });

  return NextResponse.json({ emails });
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

  const payload = createEmailSchema.parse(await request.json());

  const email = await prisma.inboundEmail.create({
    data: {
      projectId,
      sender: payload.sender,
      subject: payload.subject,
      body: payload.body,
      evidence: payload.attachments?.length
        ? {
            create: payload.attachments.map((attachment) => ({
              projectId,
              type: "inbound_email",
              status: "draft",
              title: attachment.fileName,
              fileName: attachment.fileName,
              fileUrl: attachment.fileUrl,
              storageKey: attachment.storageKey
            }))
          }
        : undefined
    },
    include: { evidence: true }
  });

  // TODO: Add inbound email triage/auto-linking workflow.

  return NextResponse.json({ email }, { status: 201 });
}
