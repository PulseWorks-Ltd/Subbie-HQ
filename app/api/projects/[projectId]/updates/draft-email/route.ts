import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { draftExternalUpdateEmail } from "@/lib/grok";
import { AiSpendCapExceededError } from "@/lib/ai-usage";
import { formatUserName } from "@/lib/user-display";

const requestSchema = z.object({
  body: z.string().min(1),
  photoCount: z.number().int().min(0).default(0)
});

// Preview step before the real "Send" — drafts a subject/body from the
// user's rough update text via Grok, returned for review/editing, nothing
// persisted here (see app/api/projects/[projectId]/updates/route.ts, which
// is where the update is actually created and the email actually sent,
// only once the user confirms).
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

  const payload = requestSchema.parse(await request.json());

  const [project, user] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { name: true, organisationId: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, email: true } })
  ]);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const drafted = await draftExternalUpdateEmail(
      {
        roughText: payload.body,
        projectName: project.name,
        authorName: (user ? formatUserName(user) : null) ?? user?.email ?? "The team",
        photoCount: payload.photoCount
      },
      { organisationId: project.organisationId, userId }
    );
    return NextResponse.json({ drafted });
  } catch (error) {
    if (error instanceof AiSpendCapExceededError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error("Drafting external update email failed:", error);
    return NextResponse.json({ error: "Could not draft an email from this update. You can still write it manually." }, { status: 422 });
  }
}
