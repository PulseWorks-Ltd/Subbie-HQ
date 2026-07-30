import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { draftUpdateThreadSummaryEmail } from "@/lib/grok";
import { AiSpendCapExceededError } from "@/lib/ai-usage";
import { formatUserName } from "@/lib/user-display";

// Preview step for "Generate outbound email" on an existing thread — drafts
// a subject/body summarising the ENTIRE thread (the top-level update plus
// every reply, in order) via Grok, returned for review/editing. Nothing is
// persisted here; the actual send + Correspondence log only happens once
// the user confirms (see this route's sibling, send-summary-email).
export async function POST(request: Request, context: { params: { projectId: string; updateId: string } }) {
  const userId = await requireUserId(request);
  const { projectId, updateId } = context.params;
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

  const [update, project, user] = await Promise.all([
    prisma.update.findFirst({
      where: { id: updateId, projectId, parentId: null },
      include: {
        author: { select: { firstName: true, lastName: true, email: true } },
        attachments: true,
        replies: {
          include: { author: { select: { firstName: true, lastName: true, email: true } }, attachments: true },
          orderBy: { createdAt: "asc" }
        }
      }
    }),
    prisma.project.findUnique({ where: { id: projectId }, select: { name: true, organisationId: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, email: true } })
  ]);

  if (!update) {
    return NextResponse.json({ error: "Update thread not found." }, { status: 404 });
  }

  const entries = [
    { authorName: formatUserName(update.author) ?? update.author.email, createdAt: update.createdAt, body: update.body },
    ...update.replies.map((reply) => ({
      authorName: formatUserName(reply.author) ?? reply.author.email,
      createdAt: reply.createdAt,
      body: reply.body
    }))
  ];
  const photoCount = update.attachments.length + update.replies.reduce((sum, reply) => sum + reply.attachments.length, 0);

  try {
    const drafted = await draftUpdateThreadSummaryEmail(
      {
        projectName: project?.name ?? "the project",
        authorName: (user ? formatUserName(user) : null) ?? user?.email ?? "The team",
        entries,
        photoCount
      },
      { organisationId: project?.organisationId ?? null, userId }
    );
    return NextResponse.json({ drafted });
  } catch (error) {
    if (error instanceof AiSpendCapExceededError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error(`Drafting thread summary email for update ${updateId} failed:`, error);
    return NextResponse.json(
      { error: "Could not draft an email from this thread. You can still write it manually." },
      { status: 422 }
    );
  }
}
