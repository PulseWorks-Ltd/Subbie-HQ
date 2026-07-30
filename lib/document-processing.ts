import { prisma } from "./prisma";
import { getSignedDownloadUrl } from "./s3";
import { extractPdfPagesWithOcrFallback, UnreadablePdfError, type PdfPage } from "./pdf-text-extraction";
import { extractContractClausesFromText, extractProgrammeFromText } from "./grok";

const PAGE_BATCH_SIZE = 8;

async function fetchPdfBuffer(storageKey: string): Promise<Uint8Array> {
  const signedUrl = await getSignedDownloadUrl(storageKey);
  const response = await fetch(signedUrl);
  return new Uint8Array(await response.arrayBuffer());
}

function batchPages(pages: PdfPage[]): PdfPage[][] {
  const batches: PdfPage[][] = [];
  for (let i = 0; i < pages.length; i += PAGE_BATCH_SIZE) {
    batches.push(pages.slice(i, i + PAGE_BATCH_SIZE));
  }
  return batches;
}

function unreadableMessage(): string {
  return (
    "This PDF's text couldn't be read automatically, even with OCR — this usually happens with documents " +
    'produced by certain "print to PDF" tools, which can look normal but don\'t contain real, extractable text. ' +
    'Please try re-exporting the document from its original source (e.g. Word, or a proper "Save as PDF"), or ' +
    "add the details manually below."
  );
}

// Runs in the background (fire-and-forget from the upload route, not awaited
// by any request) — extracts every clause from an uploaded Contract document
// via OCR-fallback text extraction, persisting Clause rows and updating
// processingStatus. Never throws to its caller — always resolves, recording
// success/failure on the ContractDocument row itself, since by design
// nothing is awaiting this call directly.
export async function processContractDocument(
  projectId: string,
  documentId: string,
  trigger: { organisationId: string | null; userId: string | null }
): Promise<void> {
  await prisma.contractDocument.update({ where: { id: documentId }, data: { processingStatus: "processing" } });

  try {
    const document = await prisma.contractDocument.findUniqueOrThrow({ where: { id: documentId } });
    const buffer = await fetchPdfBuffer(document.storageKey);
    const pages = await extractPdfPagesWithOcrFallback(buffer);

    const usageContext = { organisationId: trigger.organisationId, userId: trigger.userId, contextRef: documentId };
    const extractedBatches = await Promise.all(
      batchPages(pages).map((batch) => {
        const batchText = batch.map((p) => `--- PAGE ${p.num} ---\n${p.text}`).join("\n\n");
        return extractContractClausesFromText(batchText, usageContext);
      })
    );
    const extractedClauses = extractedBatches.flat();

    await prisma.clause.createMany({
      data: extractedClauses.map((c) => ({
        projectId,
        documentId,
        clauseRef: c.clauseRef,
        title: c.title,
        body: c.body,
        pageNumber: c.pageNumber,
        status: "parsed"
      }))
    });

    await prisma.contractDocument.update({ where: { id: documentId }, data: { processingStatus: "ready" } });
  } catch (error) {
    console.error(`Contract document processing failed for ${documentId}:`, error);
    const message =
      error instanceof UnreadablePdfError
        ? unreadableMessage()
        : "Could not read this document automatically. You can still add clauses manually.";
    await prisma.contractDocument.update({
      where: { id: documentId },
      data: { processingStatus: "failed", processingError: message }
    });
  }
}

// Same fire-and-forget shape as processContractDocument, for Programme
// uploads — extracts milestones via extractProgrammeFromText and creates
// ProgrammeItem rows, preserving the existing "supersede previous
// unconfirmed items" behavior.
export async function processProgrammeDocument(
  projectId: string,
  documentId: string,
  tradeReference: string | undefined,
  trigger: { organisationId: string | null; userId: string | null }
): Promise<void> {
  await prisma.contractDocument.update({ where: { id: documentId }, data: { processingStatus: "processing" } });

  try {
    const document = await prisma.contractDocument.findUniqueOrThrow({ where: { id: documentId } });
    const buffer = await fetchPdfBuffer(document.storageKey);
    const pages = await extractPdfPagesWithOcrFallback(buffer);
    const fullText = pages.map((p) => `--- PAGE ${p.num} ---\n${p.text}`).join("\n\n");

    const extracted = await extractProgrammeFromText(fullText, tradeReference, {
      organisationId: trigger.organisationId,
      userId: trigger.userId,
      contextRef: documentId
    });

    const previousDocument = await prisma.contractDocument.findFirst({
      where: { projectId, documentType: "programme", id: { not: documentId } },
      orderBy: { uploadedAt: "desc" }
    });
    if (previousDocument) {
      const superseded = await prisma.programmeItem.findMany({
        where: { sourceDocumentId: previousDocument.id, status: "parsed" },
        select: { id: true }
      });
      const supersededIds = superseded.map((item) => item.id);
      if (supersededIds.length) {
        await prisma.scopeProgrammeLink.deleteMany({ where: { programmeItemId: { in: supersededIds } } });
        await prisma.evidenceProgrammeItem.deleteMany({ where: { programmeItemId: { in: supersededIds } } });
        await prisma.programmeItem.deleteMany({ where: { id: { in: supersededIds } } });
      }
    }

    await prisma.$transaction(
      extracted.items.map((item) =>
        prisma.programmeItem.create({
          data: {
            projectId,
            title: item.title,
            description: item.description ?? undefined,
            startDate: item.startDate ? new Date(item.startDate) : undefined,
            endDate: item.endDate ? new Date(item.endDate) : undefined,
            status: "parsed",
            confidence: item.confidence,
            sourceDocumentId: documentId
          }
        })
      )
    );

    await prisma.contractDocument.update({ where: { id: documentId }, data: { processingStatus: "ready" } });
  } catch (error) {
    console.error(`Programme document processing failed for ${documentId}:`, error);
    const message =
      error instanceof UnreadablePdfError
        ? unreadableMessage()
        : "Could not read this document automatically. You can still add milestones manually.";
    await prisma.contractDocument.update({
      where: { id: documentId },
      data: { processingStatus: "failed", processingError: message }
    });
  }
}
