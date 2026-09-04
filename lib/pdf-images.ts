import { PDFDocument, PDFImage, rgb } from "pdf-lib";
import { loadImage, createCanvas } from "@napi-rs/canvas";
import { downloadFromS3 } from "./s3";
import { sanitizeForPdf, PdfWriter, MARGIN, CONTENT_WIDTH } from "./pdf-writer";

// Image-embedding helpers shared by any PDF generator that needs a photo
// grid — split out for the new QA Document generator (Pre-Launch-style
// feature, "Generate QA Document"). lib/variation-package-pdf.ts has its
// own private, longer-standing version of this same logic (embedImage/
// embedImageSmart/its own inline grid loop) — deliberately left untouched
// rather than refactored onto this file, since that generator is large,
// complex, and already proven in production; the risk of touching it
// isn't worth it for a feature that doesn't need to.

// Same reasoning/thresholds as variation-package-pdf.ts's own
// embedImageSmart: most single photos are small enough that touching them
// is pure overhead, but a QA Document can aggregate up to
// MAX_QA_ATTACHMENTS (12) photos per record across many records — without
// downsizing, a handful of multi-MB phone-camera photos would make for an
// unreasonably large, slow-to-open PDF.
const MAX_IMAGE_DIMENSION = 1600;
const RESIZE_THRESHOLD_BYTES = 800 * 1024;

function resolveImageKind(fileName: string, contentType: string | null | undefined): "image/png" | "image/jpeg" | null {
  if (contentType === "image/png") return "image/png";
  if (contentType === "image/jpeg" || contentType === "image/jpg") return "image/jpeg";
  if (contentType) return null; // a real, known-non-image contentType (pdf/docx/etc.) — don't guess from the filename
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return null;
}

// Downloads and embeds one photo, downsizing first if it's large. Returns
// null (never throws) for anything that isn't a recognisable image, or
// that fails to download/decode — the caller draws a placeholder instead,
// same "never fail the whole document over one bad file" rule every PDF
// generator in this app follows.
export async function embedImageSmart(doc: PDFDocument, storageKey: string, fileName: string, contentType: string | null): Promise<PDFImage | null> {
  const kind = resolveImageKind(fileName, contentType);
  if (!kind) return null;

  try {
    const bytes = await downloadFromS3(storageKey);
    if (bytes.length <= RESIZE_THRESHOLD_BYTES) {
      return kind === "image/png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    }
    const image = await loadImage(Buffer.from(bytes));
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0, width, height);
    const resized = canvas.toBuffer("image/jpeg", 82);
    return await doc.embedJpg(resized);
  } catch {
    return null;
  }
}

export type GridPhoto = { storageKey: string; fileName: string; contentType: string | null };

// A clean thumbnail grid — same visual shape as variation-package-pdf.ts's
// own private grid (110pt square cells, 12pt gaps, dynamic columns-per-row
// from CONTENT_WIDTH, a small truncated-filename caption under each), just
// generalised to a plain photo list instead of VariationPhoto[], and using
// the downsizing embed above so a QA Document's aggregate photo count
// doesn't produce a bloated file. A photo that fails to embed (unreadable,
// download failure, an attached file that isn't actually an image) draws
// a bordered "(image unavailable)" placeholder instead of being skipped
// silently or failing the whole document.
export async function drawPhotoGrid(w: PdfWriter, doc: PDFDocument, photos: GridPhoto[]): Promise<void> {
  if (photos.length === 0) {
    w.text("No photos attached.");
    return;
  }

  const thumbSize = 110;
  const gap = 12;
  const perRow = Math.max(1, Math.floor((CONTENT_WIDTH + gap) / (thumbSize + gap)));
  let col = 0;
  let rowStartY = 0;

  for (const photo of photos) {
    if (col === 0) {
      w.ensureSpace(thumbSize + 24);
      rowStartY = w.y;
    }
    const x = MARGIN + col * (thumbSize + gap);

    const image = await embedImageSmart(doc, photo.storageKey, photo.fileName, photo.contentType);
    if (image) {
      const scale = Math.min(thumbSize / image.width, thumbSize / image.height);
      const drawWidth = image.width * scale;
      const drawHeight = image.height * scale;
      w.page.drawImage(image, {
        x: x + (thumbSize - drawWidth) / 2,
        y: rowStartY - thumbSize + (thumbSize - drawHeight) / 2,
        width: drawWidth,
        height: drawHeight
      });
    } else {
      w.page.drawRectangle({
        x,
        y: rowStartY - thumbSize,
        width: thumbSize,
        height: thumbSize,
        borderColor: rgb(0.8, 0.8, 0.8),
        borderWidth: 1
      });
      w.page.drawText("(image unavailable)", { x: x + 6, y: rowStartY - thumbSize / 2, size: 7, font: w.font });
    }

    const rawCaption = photo.fileName.length > 18 ? `${photo.fileName.slice(0, 15)}...` : photo.fileName;
    const caption = sanitizeForPdf(w.font, rawCaption);
    w.page.drawText(caption, { x, y: rowStartY - thumbSize - 12, size: 7, font: w.font, color: rgb(0.4, 0.4, 0.45) });

    col += 1;
    if (col >= perRow) {
      col = 0;
      w.y = rowStartY - thumbSize - 24;
    }
  }
  if (col !== 0) {
    w.y = rowStartY - thumbSize - 24;
  }
}
