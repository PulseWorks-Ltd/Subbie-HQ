import { PDFParse } from "pdf-parse";
import { createWorker, OEM } from "tesseract.js";
import { fileURLToPath } from "node:url";
import path from "node:path";

export type PdfPage = { num: number; text: string };

// Bundled locally rather than left to tesseract.js's default behavior (which
// downloads eng.traineddata.gz from a CDN on first use and caches it in
// whatever the current working directory happens to be). Bundling removes a
// runtime network dependency for OCR entirely and avoids depending on cwd
// assumptions about the production container. Path computed relative to this
// module file, not process.cwd(), so it's correct regardless of where the
// process was started from.
const OCR_DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "ocr-data");

// Some PDFs — most commonly ones produced by "print to PDF" driver pipelines
// (we've seen Creator: PScript5.dll / Producer: Ghostscript in the wild) —
// render perfectly on screen but have a broken or missing font ToUnicode
// mapping, so text-extraction tools pull out garbage instead of real
// characters. Two independent extraction engines (pdf-parse/pdfjs-dist and
// poppler's pdftotext) were confirmed to both fail identically on such a
// file, which is what this module exists to detect and work around.
export class UnreadablePdfError extends Error {
  constructor(message = "Could not extract readable text from this PDF, even with OCR.") {
    super(message);
    this.name = "UnreadablePdfError";
  }
}

const COMMON_WORDS = new Set([
  "the", "and", "of", "to", "a", "in", "for", "is", "on", "that", "by", "this", "with",
  "or", "be", "shall", "as", "at", "from", "any", "will", "must", "not", "all", "which",
  "under", "party", "contract", "work", "if", "are", "was", "have", "has"
]);

// Real English prose (construction contracts especially) runs 15-25%
// common-word density; garbled/broken-encoding text — whatever nonsense
// characters it happens to produce — essentially never coincidentally
// produces a comparable density of real English stopwords. Validated
// against a genuinely garbled contract PDF (~3.7%) vs the same PDF's
// OCR'd text (~34%) and a normal clean contract (~27%) — 8% sits with a
// clear margin on both sides.
const READABILITY_THRESHOLD = 0.08;
const MIN_WORD_COUNT = 50;

export function looksLikeReadableText(text: string): boolean {
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  if (words.length < MIN_WORD_COUNT) return false;
  const commonCount = words.filter((word) => COMMON_WORDS.has(word)).length;
  return commonCount / words.length > READABILITY_THRESHOLD;
}

const OCR_CONCURRENCY = 4;
// Rendering every page to a PNG upfront (as one getScreenshot() call would)
// holds all of them in memory at once — fine for a handful of pages, but a
// real spike for a 100-page document on a memory-constrained container.
// Rendering in small chunks and feeding a shared queue that OCR workers
// drain as they go keeps peak memory bounded and lets OCR start on the
// first chunk while later pages are still being rendered.
const RENDER_CHUNK_SIZE = 6;
const MAX_QUEUE_SIZE = RENDER_CHUNK_SIZE * 2;

async function ocrPages(buffer: Uint8Array, pageCount: number): Promise<PdfPage[]> {
  const results: PdfPage[] = [];
  const queue: { pageNumber: number; data: Uint8Array }[] = [];
  let renderingDone = false;
  let waiters: (() => void)[] = [];

  function wake() {
    const toWake = waiters;
    waiters = [];
    toWake.forEach((resolve) => resolve());
  }

  function waitForSignal(): Promise<void> {
    return new Promise((resolve) => waiters.push(resolve));
  }

  async function renderProducer() {
    for (let start = 1; start <= pageCount; start += RENDER_CHUNK_SIZE) {
      while (queue.length >= MAX_QUEUE_SIZE) {
        await waitForSignal();
      }
      const pageNumbers = Array.from(
        { length: Math.min(RENDER_CHUNK_SIZE, pageCount - start + 1) },
        (_, i) => start + i
      );
      // pdfjs-dist detaches/transfers the underlying ArrayBuffer of whatever
      // Uint8Array it's given — always hand each PDFParse instance its own
      // fresh copy, never reuse one across instances.
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const screenshot = await parser.getScreenshot({ partial: pageNumbers, desiredWidth: 1600 });
      await parser.destroy();
      queue.push(...screenshot.pages.map((p) => ({ pageNumber: p.pageNumber, data: p.data })));
      wake();
    }
    renderingDone = true;
    wake();
  }

  async function consumeWorker() {
    const tesseractWorker = await createWorker("eng", OEM.LSTM_ONLY, {
      cachePath: OCR_DATA_DIR,
      langPath: OCR_DATA_DIR,
      gzip: false
    });
    try {
      while (true) {
        const page = queue.shift();
        if (!page) {
          if (renderingDone) return;
          await waitForSignal();
          continue;
        }
        wake(); // room freed in the queue — let the producer render more
        const { data } = await tesseractWorker.recognize(Buffer.from(page.data));
        results.push({ num: page.pageNumber, text: data.text });
      }
    } finally {
      await tesseractWorker.terminate();
    }
  }

  const workerCount = Math.min(OCR_CONCURRENCY, pageCount);
  await Promise.all([renderProducer(), ...Array.from({ length: workerCount }, () => consumeWorker())]);

  return results.sort((a, b) => a.num - b.num);
}

// Extracts page text from a PDF, falling back to OCR (render page -> image ->
// Tesseract) when the normal text layer looks unreadable. Throws
// UnreadablePdfError if the PDF still can't be read after the OCR attempt —
// callers should surface that as "this document can't be assessed
// automatically," not silently proceed with garbage/empty text.
export async function extractPdfPagesWithOcrFallback(buffer: Uint8Array): Promise<PdfPage[]> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const { pages } = await parser.getText();
  await parser.destroy();

  if (!pages.length) {
    throw new UnreadablePdfError("No extractable pages found in this PDF.");
  }

  const combinedText = pages.map((p) => p.text).join("\n");
  if (looksLikeReadableText(combinedText)) {
    return pages;
  }

  const ocrPagesResult = await ocrPages(buffer, pages.length);
  const ocrCombinedText = ocrPagesResult.map((p) => p.text).join("\n");
  if (!looksLikeReadableText(ocrCombinedText)) {
    throw new UnreadablePdfError();
  }

  return ocrPagesResult;
}
