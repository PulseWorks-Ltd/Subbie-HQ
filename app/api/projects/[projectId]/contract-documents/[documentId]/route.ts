import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { deleteFromS3 } from "@/lib/s3";

const updateDocumentSchema = z.object({
  status: z.enum(["draft", "parsed", "confirmed"])
});

export async function PATCH(
  request: Request,
  context: { params: { projectId: string; documentId: string } }
) {
  const userId = await requireUserId(request);
  const { projectId, documentId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const canAccessModule = await requireModuleAccess(projectId, userId, "contract");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = updateDocumentSchema.parse(await request.json());

  const document = await prisma.contractDocument.update({
    where: { id: documentId, projectId },
    data: { status: payload.status }
  });

  return NextResponse.json({ document });
}

// Deletes the document itself and everything that belongs exclusively to it
// (its clauses, reviews/deviations, and the required-cover rows it
// produced) — but only DETACHES things that have an independent life of
// their own (confirmed ContractTerms, real ScopeItem/ProgrammeItem records,
// Correspondence entries) rather than deleting them, since those shouldn't
// disappear just because the document that originally suggested them did.
// Lets a wrongly-uploaded contract be removed and replaced without losing
// unrelated project data.
export async function DELETE(
  request: Request,
  context: { params: { projectId: string; documentId: string } }
) {
  const userId = await requireUserId(request);
  const { projectId, documentId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const canAccessModule = await requireModuleAccess(projectId, userId, "contract");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const document = await prisma.contractDocument.findFirst({ where: { id: documentId, projectId } });
  if (!document) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [clauses, reviews] = await Promise.all([
    prisma.clause.findMany({ where: { documentId }, select: { id: true } }),
    prisma.contractReview.findMany({ where: { documentId }, select: { id: true } })
  ]);
  const clauseIds = clauses.map((c) => c.id);
  const reviewIds = reviews.map((r) => r.id);

  await prisma.$transaction([
    // Detach — these records are independent of the source document.
    prisma.contractTerms.updateMany({ where: { sourceDocumentId: documentId }, data: { sourceDocumentId: null } }),
    prisma.scopeItem.updateMany({ where: { sourceDocumentId: documentId }, data: { sourceDocumentId: null } }),
    prisma.scopeItem.updateMany({ where: { sourceClauseId: { in: clauseIds } }, data: { sourceClauseId: null } }),
    prisma.programmeItem.updateMany({ where: { sourceDocumentId: documentId }, data: { sourceDocumentId: null } }),
    prisma.correspondence.updateMany({ where: { outcomeContractDocumentId: documentId }, data: { outcomeContractDocumentId: null } }),
    prisma.correspondence.updateMany({ where: { sourceContractReviewId: { in: reviewIds } }, data: { sourceContractReviewId: null } }),
    // Delete — these belong exclusively to this document.
    prisma.contractRequiredCover.deleteMany({ where: { sourceDocumentId: documentId } }),
    prisma.contractDeviation.deleteMany({ where: { contractReviewId: { in: reviewIds } } }),
    prisma.contractReview.deleteMany({ where: { documentId } }),
    prisma.clause.deleteMany({ where: { documentId } }),
    prisma.contractDocument.delete({ where: { id: documentId } })
  ]);

  await deleteFromS3(document.storageKey).catch(() => {});

  return NextResponse.json({ ok: true });
}
