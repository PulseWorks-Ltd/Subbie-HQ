import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { draftQaDocumentEmail } from "@/lib/grok";
import { formatQaDocumentNumber } from "@/lib/qa-document-pdf";
import { AiSpendCapExceededError } from "@/lib/ai-usage";
import { formatUserName } from "@/lib/user-display";

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

// "Generate QA Document" — same preview-then-review shape as the Payment
// Claim draft-email route: nothing is sent here, just a subject/body
// handed back for the user to edit (see the send route for the actual send).
export async function POST(request: Request, context: { params: { projectId: string; qaDocumentId: string } }) {
  const userId = await requireUserId(request);
  const { projectId, qaDocumentId } = context.params;
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

  const [qaDocument, project, user] = await Promise.all([
    prisma.qaDocument.findFirst({
      where: { id: qaDocumentId, projectId },
      include: { records: { include: { qaRecord: { select: { date: true } } } } }
    }),
    prisma.project.findUnique({ where: { id: projectId }, select: { name: true, organisationId: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, email: true } })
  ]);
  if (!qaDocument) {
    return NextResponse.json({ error: "QA Document not found." }, { status: 404 });
  }

  const dates = qaDocument.records.map((r) => r.qaRecord.date.getTime());
  const periodDescription =
    dates.length > 0 ? `${formatDate(new Date(Math.min(...dates)))} to ${formatDate(new Date(Math.max(...dates)))}` : "—";

  try {
    const drafted = await draftQaDocumentEmail(
      {
        projectName: project?.name ?? "the project",
        docNumber: formatQaDocumentNumber(qaDocument.docNumber),
        recordCount: qaDocument.records.length,
        periodDescription,
        authorName: (user ? formatUserName(user) : null) ?? user?.email ?? "The team"
      },
      { organisationId: project?.organisationId ?? null, userId }
    );
    return NextResponse.json({ drafted });
  } catch (error) {
    if (error instanceof AiSpendCapExceededError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error("Drafting QA Document email failed:", error);
    return NextResponse.json({ error: "Could not draft an email for this document. You can still write it manually." }, { status: 422 });
  }
}
