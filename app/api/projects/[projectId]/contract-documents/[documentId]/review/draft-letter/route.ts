import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { uploadToS3 } from "@/lib/s3";
import { draftResponseLetter } from "@/lib/grok";
import { RESPONSE_LETTER_DISCLAIMER } from "@/lib/legal-disclaimer";

const requestSchema = z.object({
  contractReviewId: z.string().min(1),
  deviationIds: z.array(z.string()).min(1),
  contactId: z.string().min(1)
});

function comparedAgainstLabel(type: string): string {
  return type === "prior_contract"
    ? "their previous contract with this Main Contractor"
    : "the SA-2017 standard-form baseline";
}

export async function POST(
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
  const canAccessContract = await requireModuleAccess(projectId, userId, "contract");
  const canAccessCorrespondence = await requireModuleAccess(projectId, userId, "correspondence");
  if (!canAccessContract || !canAccessCorrespondence) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = requestSchema.parse(await request.json());

  const document = await prisma.contractDocument.findFirst({
    where: { id: documentId, projectId },
    include: { project: { include: { mainContractor: true } } }
  });
  if (!document) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!document.project.mainContractorId || !document.project.mainContractor) {
    return NextResponse.json({ error: "This project has no Main Contractor assigned." }, { status: 400 });
  }

  const contact = await prisma.mainContractorContact.findFirst({
    where: { id: payload.contactId, mainContractorId: document.project.mainContractorId }
  });
  if (!contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 400 });
  }

  // Deviations can come from either the displayed primary review or its
  // sibling baseline shadow review (the newBaselineDriftCount callout) —
  // both belong to this same document, so scope the lookup there rather
  // than to one specific review.
  const deviations = await prisma.contractDeviation.findMany({
    where: { id: { in: payload.deviationIds }, contractReview: { documentId } },
    include: { contractReview: { select: { comparedAgainstType: true } } }
  });
  if (deviations.length === 0) {
    return NextResponse.json({ error: "No matching flagged clauses found." }, { status: 400 });
  }

  const drafted = await draftResponseLetter(
    deviations.map((d) => ({
      baselineClauseRef: d.baselineClauseRef,
      baselineClauseTitle: d.baselineClauseTitle,
      subcontractClauseRef: d.subcontractClauseRef,
      rationale: d.rationale,
      recommendation: d.recommendation,
      comparedAgainstLabel: comparedAgainstLabel(d.contractReview.comparedAgainstType)
    })),
    {
      mainContractorName: document.project.mainContractor.name,
      contactName: contact.name,
      contactRole: contact.role,
      projectName: document.project.name
    }
  );

  const letterBody = `${drafted.letterBody}\n\n---\n${RESPONSE_LETTER_DISCLAIMER}`;
  const fileName = `response-letter-draft-${Date.now()}.txt`;
  const uploadKey = `projects/${projectId}/correspondence/${fileName}`;
  const { storageKey } = await uploadToS3({
    key: uploadKey,
    body: new TextEncoder().encode(letterBody),
    contentType: "text/plain"
  });

  const correspondence = await prisma.correspondence.create({
    data: {
      projectId,
      title: `Response letter draft — ${new Date().toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })}`,
      source: "response_letter_draft",
      fileName,
      storageKey,
      bodyText: letterBody,
      addressedToContactId: contact.id,
      sourceContractReviewId: payload.contractReviewId,
      sourceDeviationIds: payload.deviationIds
    }
  });

  return NextResponse.json({ correspondence }, { status: 201 });
}
