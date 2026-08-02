import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { extractQuoteFromDocument } from "@/lib/document-processing";
import { UnreadablePdfError } from "@/lib/pdf-text-extraction";
import { AiSpendCapExceededError } from "@/lib/ai-usage";

// Runs synchronously (see lib/document-processing.ts's extractQuoteFromDocument)
// against an already-uploaded document the user has explicitly marked as
// the project's quote (documentType: "quote" — set via the sibling PATCH
// route). Only stores extracted data against ProjectQuote; builds no
// comparison logic. One quote per project — re-running this (e.g. after
// marking a revised quote) replaces the previous stored result wholesale.
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
  const canAccessModule = await requireModuleAccess(projectId, userId, "contract");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const document = await prisma.contractDocument.findFirst({ where: { id: documentId, projectId } });
  if (!document) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (document.documentType !== "quote") {
    return NextResponse.json({ error: "Mark this document as a quote before extracting." }, { status: 400 });
  }

  try {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { organisationId: true } });
    const extracted = await extractQuoteFromDocument(document.storageKey, {
      organisationId: project?.organisationId ?? null,
      userId,
      contextRef: documentId
    });

    const quote = await prisma.projectQuote.upsert({
      where: { projectId },
      create: {
        projectId,
        sourceDocumentId: documentId,
        quotedValue: extracted.quotedValue,
        quotedDate: extracted.quotedDate ? new Date(extracted.quotedDate) : null,
        scopeSummary: extracted.scopeSummary,
        lineItems: extracted.lineItems,
        commercialNotes: extracted.commercialNotes
      },
      update: {
        sourceDocumentId: documentId,
        quotedValue: extracted.quotedValue,
        quotedDate: extracted.quotedDate ? new Date(extracted.quotedDate) : null,
        scopeSummary: extracted.scopeSummary,
        lineItems: extracted.lineItems,
        commercialNotes: extracted.commercialNotes,
        extractedAt: new Date()
      }
    });

    return NextResponse.json({ quote });
  } catch (error) {
    if (error instanceof AiSpendCapExceededError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    const message =
      error instanceof UnreadablePdfError
        ? "This document's text couldn't be read automatically, even with OCR."
        : "Could not read this document automatically.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
