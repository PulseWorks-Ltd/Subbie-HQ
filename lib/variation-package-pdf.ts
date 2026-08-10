import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { loadImage, createCanvas } from "@napi-rs/canvas";
import type {
  Correspondence,
  DayWorksMaterial,
  DayWorksPlant,
  InboundEmail,
  Update,
  UpdateAttachment,
  UpdateRecipient,
  User,
  VariationItem,
  VariationPhoto
} from "@prisma/client";
import { downloadFromS3 } from "./s3";
import { formatUserName } from "./user-display";
import {
  computeSheetRecordTotal,
  computeCombinedLabourSummary,
  computeMaterialsSummary,
  computePlantCost,
  computePackageTotals,
  type DayWorksSheetWithRecords
} from "./variation-package";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function formatCurrency(amount: number) {
  return amount.toLocaleString("en-NZ", { style: "currency", currency: "NZD" });
}

function formatDate(date: Date | null | undefined) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

// pdf-lib's standard fonts (Helvetica etc.) use WinAnsi encoding, a fixed
// ~Windows-1252 character set, and THROW rather than skip a character
// outside it — confirmed in production: "WinAnsi cannot encode "​"
// (0x200b)" (a zero-width space) crashed an entire Variation Package
// generation because it appeared once in a rendered email body. Real
// email/user text regularly contains characters like this (zero-width
// spaces, emoji, symbols), often invisibly, without the sender knowing.
//
// Empirically verified against pdf-lib directly (not assumed): smart
// quotes, em/en dashes, ellipsis, and non-breaking space all already
// encode correctly via WinAnsi — Windows-1252 natively includes them —
// so this only touches characters that genuinely can't be encoded (zero-
// width spaces, emoji, most symbol/dingbat characters, non-Latin
// scripts), tested against the real font object via the exact call that
// crashed in production (widthOfTextAtSize), not a hand-maintained guess
// at WinAnsi's repertoire. That also makes this robust to any future
// unsupported character, not just U+200B specifically.
const encodabilityCache = new Map<string, boolean>();

function canEncode(font: PDFFont, char: string): boolean {
  const cached = encodabilityCache.get(char);
  if (cached !== undefined) return cached;
  let ok: boolean;
  try {
    font.widthOfTextAtSize(char, 10);
    ok = true;
  } catch {
    ok = false;
  }
  encodabilityCache.set(char, ok);
  return ok;
}

// Genuinely unencodable characters are stripped rather than replaced with
// a placeholder glyph — a zero-width space has zero visual width anyway
// (stripping it changes nothing visible), and for something like an
// emoji or dingbat, dropping it silently is preferable to risking the
// placeholder itself also being unencodable.
function sanitizeForPdf(font: PDFFont, text: string): string {
  let result = "";
  for (const char of text) {
    result += canEncode(font, char) ? char : "";
  }
  return result;
}

// Thin pagination-aware cursor around pdf-lib's page-at-a-time drawing API
// — pdf-lib has no built-in flowed-text/pagination support, so this is the
// minimum needed to lay out a multi-section, multi-page document without
// text running off the bottom of a page.
class PdfWriter {
  doc: PDFDocument;
  font: PDFFont;
  boldFont: PDFFont;
  page: PDFPage;
  y: number;

  constructor(doc: PDFDocument, font: PDFFont, boldFont: PDFFont) {
    this.doc = doc;
    this.font = font;
    this.boldFont = boldFont;
    this.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  ensureSpace(height: number) {
    if (this.y - height < MARGIN) {
      this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      this.y = PAGE_HEIGHT - MARGIN;
    }
  }

  // Unconditionally starts a fresh blank page — distinct from ensureSpace,
  // which only adds one when the current page is actually full. Used
  // after embedding raw evidence content (copied PDF pages, full-page
  // images) that the writer didn't lay out itself, so subsequent text
  // never gets drawn on top of embedded content.
  newPage() {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  private wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
    return lines.length > 0 ? lines : [""];
  }

  heading(text: string) {
    text = sanitizeForPdf(this.boldFont, text);
    this.ensureSpace(28);
    this.page.drawText(text, { x: MARGIN, y: this.y, size: 14, font: this.boldFont, color: rgb(0.05, 0.08, 0.12) });
    this.y -= 22;
  }

  subheading(text: string) {
    text = sanitizeForPdf(this.boldFont, text);
    this.ensureSpace(20);
    this.page.drawText(text, { x: MARGIN, y: this.y, size: 11, font: this.boldFont, color: rgb(0.1, 0.1, 0.12) });
    this.y -= 16;
  }

  text(text: string, opts: { size?: number; bold?: boolean; indent?: number; color?: [number, number, number] } = {}) {
    const size = opts.size ?? 10;
    const font = opts.bold ? this.boldFont : this.font;
    const indent = opts.indent ?? 0;
    const color = opts.color ? rgb(...opts.color) : rgb(0.15, 0.15, 0.18);
    const lines = this.wrap(sanitizeForPdf(font, text), font, size, CONTENT_WIDTH - indent);
    for (const line of lines) {
      this.ensureSpace(size + 5);
      this.page.drawText(line, { x: MARGIN + indent, y: this.y, size, font, color });
      this.y -= size + 5;
    }
  }

  row(left: string, right: string, opts: { bold?: boolean; indent?: number } = {}) {
    this.ensureSpace(15);
    const font = opts.bold ? this.boldFont : this.font;
    const indent = opts.indent ?? 0;
    left = sanitizeForPdf(font, left);
    right = sanitizeForPdf(font, right);
    this.page.drawText(left, { x: MARGIN + indent, y: this.y, size: 10, font, color: rgb(0.15, 0.15, 0.18) });
    const rightWidth = font.widthOfTextAtSize(right, 10);
    this.page.drawText(right, {
      x: PAGE_WIDTH - MARGIN - rightWidth,
      y: this.y,
      size: 10,
      font,
      color: rgb(0.15, 0.15, 0.18)
    });
    this.y -= 15;
  }

  spacer(height = 10) {
    this.y -= height;
  }

  divider() {
    this.ensureSpace(12);
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_WIDTH - MARGIN, y: this.y },
      thickness: 0.5,
      color: rgb(0.85, 0.87, 0.9)
    });
    this.y -= 12;
  }
}

async function embedImage(doc: PDFDocument, storageKey: string, contentType: string) {
  const bytes = await downloadFromS3(storageKey);
  if (contentType === "image/png") return doc.embedPng(bytes);
  return doc.embedJpg(bytes);
}

type EmbedKind = "pdf" | "image/png" | "image/jpeg" | "unknown";

// Prefers a real, already-known contentType (Day Works Sheets, materials/
// plant receipt photos, standalone Photos, Update attachments all store
// one) and falls back to the file extension for the handful of legacy
// fields that never got a contentType column (VariationItem's source
// document/quote, Correspondence uploads) — see this file's task notes.
function resolveEmbedKind(fileName: string | null | undefined, contentType: string | null | undefined): EmbedKind {
  if (contentType === "application/pdf") return "pdf";
  if (contentType === "image/png") return "image/png";
  if (contentType === "image/jpeg" || contentType === "image/jpg") return "image/jpeg";

  const ext = (fileName ?? "").toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf") return "pdf";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return "unknown";
}

// Only bother decoding/re-encoding when the source is already reasonably
// large — most receipt/docket/update photos are small enough that
// touching them at all would be pure overhead. Day-works receipt photos
// in particular are routinely multi-MB phone-camera JPEGs, and a single
// package can accumulate many of them (every material/plant line item,
// every update, every standalone photo) — embedding all of them at full
// original resolution would produce an unreasonably large, slow-to-open
// combined PDF. 1600px matches the resolution already validated
// elsewhere in this codebase for "legible but not huge" (see
// lib/pdf-text-extraction.ts's renderPdfPagesToImages).
const MAX_IMAGE_DIMENSION = 1600;
const RESIZE_THRESHOLD_BYTES = 800 * 1024;

async function embedImageSmart(doc: PDFDocument, bytes: Uint8Array, kind: "image/png" | "image/jpeg"): Promise<PDFImage> {
  if (bytes.length <= RESIZE_THRESHOLD_BYTES) {
    return kind === "image/png" ? doc.embedPng(bytes) : doc.embedJpg(bytes);
  }

  const image = await loadImage(Buffer.from(bytes));
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0, width, height);
  const resized = canvas.toBuffer("image/jpeg", 82);
  return doc.embedJpg(resized);
}

function drawImageFitted(page: PDFPage, image: PDFImage) {
  const availWidth = PAGE_WIDTH - MARGIN * 2;
  const availHeight = PAGE_HEIGHT - MARGIN * 2;
  const scale = Math.min(availWidth / image.width, availHeight / image.height, 1);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  page.drawImage(image, {
    x: (PAGE_WIDTH - drawWidth) / 2,
    y: (PAGE_HEIGHT - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight
  });
}

// The core "embed real content, or fall back gracefully" primitive every
// evidence type in this file goes through (Task 1.7) — a PDF's actual
// pages are copied in (real content, not a rasterised screenshot, per
// Task 2.2); an image is embedded full-page, downscaling first if it's
// unusually large (Task 2.4); anything else — an unrecognised file type,
// a download failure, a corrupt/encrypted PDF pdf-lib can't parse — falls
// through to a placeholder notice rather than failing the whole
// generation. Always draws one label page first (so a big bundle of
// concatenated evidence stays navigable), then either the real content
// or the placeholder explanation lands on/after that same page. Doesn't
// force a trailing fresh page on success — every caller of this function
// (and renderTextEvidencePage) already starts with its own w.newPage(),
// so an extra one here would just be a wasted blank page between every
// pair of evidence items.
async function embedSourceFile(
  w: PdfWriter,
  file: { fileName: string; storageKey: string; contentType?: string | null },
  label: string
): Promise<void> {
  w.newPage();
  w.heading(label);

  try {
    const kind = resolveEmbedKind(file.fileName, file.contentType);
    if (kind === "unknown") {
      throw new Error(`Unsupported file type for "${file.fileName}"`);
    }

    const bytes = await downloadFromS3(file.storageKey);

    if (kind === "pdf") {
      const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const copiedPages = await w.doc.copyPages(srcDoc, srcDoc.getPageIndices());
      for (const page of copiedPages) {
        w.doc.addPage(page);
      }
    } else {
      const image = await embedImageSmart(w.doc, bytes, kind);
      const page = w.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      drawImageFitted(page, image);
    }
  } catch {
    w.text(`"${file.fileName}" could not be embedded inline in this package.`, { bold: true, color: [0.6, 0.15, 0.15] });
    w.text("The original file remains available in Subbie HQ under this item's evidence.");
  }
}

function renderTextEvidencePage(w: PdfWriter, opts: { heading: string; meta: { label: string; value: string }[]; body: string }) {
  w.newPage();
  w.heading(opts.heading);
  for (const m of opts.meta) {
    w.row(m.label, m.value);
  }
  w.spacer(8);
  w.divider();
  w.spacer(4);
  w.text(opts.body || "(no content)");
}

type CorrespondenceWithRelations = Correspondence & {
  inboundEmail: InboundEmail | null;
  sourceUpdate: (Update & { author: Pick<User, "firstName" | "lastName" | "email">; recipients: UpdateRecipient[] }) | null;
};

// Task 1.4's "if it doesn't [have a file], render the email content"
// branch — most correspondence is exactly that (an inbound email, a
// sent-externally Update, or an AI-drafted letter whose real content is
// text, not a real attached document), so this pulls whichever source
// actually holds the text for this entry, rather than showing just a
// one-line summary as the cover page's checklist already does.
async function embedCorrespondenceEntry(w: PdfWriter, item: CorrespondenceWithRelations): Promise<void> {
  const kind = resolveEmbedKind(item.fileName, null);
  if (item.fileName && item.storageKey && kind !== "unknown") {
    await embedSourceFile(w, { fileName: item.fileName, storageKey: item.storageKey }, `Correspondence — ${item.title}`);
    return;
  }

  if (item.source === "inbound_email" && item.inboundEmail) {
    const meta = [
      { label: "Date", value: formatDate(item.inboundEmail.receivedAt) },
      { label: "From", value: item.inboundEmail.sender }
    ];
    if (item.inboundEmail.ccAddresses.length > 0) {
      meta.push({ label: "Cc", value: item.inboundEmail.ccAddresses.join(", ") });
    }
    renderTextEvidencePage(w, { heading: `Correspondence — ${item.inboundEmail.subject}`, meta, body: item.inboundEmail.body });
    return;
  }

  if (item.source === "response_letter_draft" && item.bodyText) {
    renderTextEvidencePage(w, {
      heading: `Correspondence — ${item.title}`,
      meta: [{ label: "Date", value: formatDate(item.createdAt) }],
      body: item.bodyText
    });
    return;
  }

  if (item.source === "external_update" && item.sourceUpdate) {
    renderTextEvidencePage(w, {
      heading: `Correspondence — ${item.sourceUpdate.externalSubject ?? item.title}`,
      meta: [
        { label: "Date", value: formatDate(item.sourceUpdate.externalSentAt) },
        { label: "From", value: formatUserName(item.sourceUpdate.author) ?? item.sourceUpdate.author.email },
        { label: "To", value: item.sourceUpdate.recipients.map((r) => r.email).join(", ") || "—" }
      ],
      body: item.sourceUpdate.externalBody ?? ""
    });
    return;
  }

  // No file and no linked content to draw text from (e.g. an "upload"-
  // source row whose file has since gone missing) — still surfaces the
  // entry rather than silently dropping it from the package.
  renderTextEvidencePage(w, {
    heading: `Correspondence — ${item.title}`,
    meta: [{ label: "Date", value: formatDate(item.createdAt) }],
    body: "No file or content available for this correspondence entry."
  });
}

type UpdateWithRelations = Update & {
  author: Pick<User, "firstName" | "lastName" | "email">;
  attachments: UpdateAttachment[];
};

// Task 1.5 — an Update's real content followed immediately by any photos
// attached to that same Update. Externally-sent updates show the actual
// emailed subject/body (externalSubject/externalBody), the human-reviewed
// final content, not the author's original rough draft in `body`.
async function embedUpdateEntry(w: PdfWriter, update: UpdateWithRelations): Promise<void> {
  const wasSentExternally = update.isExternal && update.externalSentAt;
  renderTextEvidencePage(w, {
    heading: wasSentExternally ? `Update — ${update.externalSubject ?? "Sent update"}` : "Update",
    meta: [
      { label: "Date", value: formatDate(wasSentExternally ? update.externalSentAt : update.createdAt) },
      { label: "Author", value: formatUserName(update.author) ?? update.author.email }
    ],
    body: (wasSentExternally ? update.externalBody : update.body) || update.body
  });

  for (const attachment of update.attachments) {
    await embedSourceFile(
      w,
      { fileName: attachment.fileName, storageKey: attachment.storageKey, contentType: attachment.contentType },
      `Update photo — ${attachment.fileName}`
    );
  }
}

export async function generateVariationPackagePdf(params: {
  item: VariationItem;
  photos: VariationPhoto[];
  correspondence: CorrespondenceWithRelations[];
  dayWorksSheets: DayWorksSheetWithRecords[];
  materials: DayWorksMaterial[];
  plant: DayWorksPlant[];
  updates: UpdateWithRelations[];
  contractTerms: { materialsMarkupPercent: number | null } | null;
  generatedByName: string;
}): Promise<Uint8Array> {
  const { item, photos, correspondence, dayWorksSheets, materials, plant, updates, contractTerms, generatedByName } = params;

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const w = new PdfWriter(doc, font, boldFont);

  const packageTotals = computePackageTotals(dayWorksSheets, materials, plant, contractTerms);

  // --- Header (Task 1.1 — unchanged from before this feature) ---
  w.heading(`Variation Package — ${item.reference}`);
  w.text(item.title, { size: 13, bold: true });
  w.spacer(6);
  w.row("Type", item.type === "variation" ? "Variation" : "Site Instruction");
  w.row("Date notified", formatDate(item.notifiedAt));
  w.row("Instructed by", item.instructedByName || "Not recorded");
  if (item.description) {
    w.spacer(4);
    w.text(item.description, { indent: 0 });
  }
  w.spacer(8);
  w.divider();

  // --- Evidence checklist (literal counts only — no AI sufficiency judgement) ---
  w.subheading("Evidence included");
  w.text(
    `Photos (${photos.length}), Correspondence (${correspondence.length}), Day Works Sheets (${dayWorksSheets.length}), Materials (${materials.length}), Plant (${plant.length})`
  );
  w.spacer(10);
  w.divider();

  // --- Photos thumbnail grid (unchanged from before this feature — the
  // full-page standalone Photos embed happens later, see Task 1.6) ---
  w.subheading(`Photos (${photos.length})`);
  if (photos.length === 0) {
    w.text("No photos attached.");
  } else {
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

      try {
        const image = await embedImage(doc, photo.storageKey, photo.contentType);
        const scale = Math.min(thumbSize / image.width, thumbSize / image.height);
        const drawWidth = image.width * scale;
        const drawHeight = image.height * scale;
        w.page.drawImage(image, {
          x: x + (thumbSize - drawWidth) / 2,
          y: rowStartY - thumbSize + (thumbSize - drawHeight) / 2,
          width: drawWidth,
          height: drawHeight
        });
      } catch {
        w.page.drawRectangle({
          x,
          y: rowStartY - thumbSize,
          width: thumbSize,
          height: thumbSize,
          borderColor: rgb(0.8, 0.8, 0.8),
          borderWidth: 1
        });
        w.page.drawText("(image unavailable)", { x: x + 6, y: rowStartY - thumbSize / 2, size: 7, font });
      }
      const rawCaption = photo.fileName.length > 18 ? `${photo.fileName.slice(0, 15)}...` : photo.fileName;
      const caption = sanitizeForPdf(font, rawCaption);
      w.page.drawText(caption, { x, y: rowStartY - thumbSize - 12, size: 7, font, color: rgb(0.4, 0.4, 0.45) });

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
  w.spacer(10);
  w.divider();

  // --- Correspondence (computed list — unchanged; real content follows later, Task 1.4) ---
  w.subheading(`Correspondence (${correspondence.length})`);
  if (correspondence.length === 0) {
    w.text("No correspondence attached.");
  } else {
    for (const item2 of correspondence) {
      w.text(`${formatDate(item2.createdAt)} — ${item2.title} (${item2.source})`);
    }
  }
  w.spacer(10);
  w.divider();

  // --- Day Works Sheets computed breakdown — labour only now (Materials/
  // Plant are independent of any sheet, see their own sections below;
  // Labour, Plant & Material AI Extraction) ---
  w.subheading(`Day Works Sheets (${dayWorksSheets.length})`);
  if (dayWorksSheets.length === 0) {
    w.text("No Day Works Sheets attached.");
  }
  for (const sheet of dayWorksSheets) {
    const sheetLabour = computeCombinedLabourSummary([sheet]);
    w.spacer(4);
    w.text(sheet.fileName, { bold: true });

    if (sheet.sheetRecords.length > 0) {
      w.text("Dayworks Summary:", { bold: true, indent: 10 });
      for (const record of sheet.sheetRecords) {
        const hours = record.totalHours != null ? Number(record.totalHours) : null;
        const rate = record.ratePerHour != null ? Number(record.ratePerHour) : null;
        const total = computeSheetRecordTotal(record.totalHours, record.ratePerHour);
        const description = [
          record.sheetNumber,
          `${record.teamLeaderCount} leader${record.teamLeaderCount === 1 ? "" : "s"}`,
          `${record.teamMemberCount} member${record.teamMemberCount === 1 ? "" : "s"}`,
          hours != null ? `${hours}h` : "hours not recorded",
          rate != null ? `@ ${formatCurrency(rate)}/hr` : "rate not entered"
        ].join(" · ");
        w.row(description, total != null ? formatCurrency(total) : "—", { indent: 16 });
      }
      w.row("Labour total", formatCurrency(sheetLabour.total), { bold: true, indent: 10 });
    } else {
      w.text("No labour summary recorded.", { indent: 10 });
    }
    w.spacer(6);
  }
  w.divider();

  // --- Materials — independent of any sheet (Labour, Plant & Material AI
  // Extraction) ---
  w.subheading(`Materials (${materials.length})`);
  if (materials.length === 0) {
    w.text("No materials attached.");
  } else {
    for (const material of materials) {
      w.row(
        `${material.description} — ${Number(material.quantity)} ${material.unit} @ ${formatCurrency(Number(material.unitCost))}`,
        formatCurrency(Number(material.quantity) * Number(material.unitCost))
      );
    }
    const { materialsCost, materialsMarkupAmount } = computeMaterialsSummary(materials, contractTerms);
    w.row("Materials total", formatCurrency(materialsCost), { bold: true });
    if (materialsMarkupAmount > 0) {
      w.row("Materials markup", formatCurrency(materialsMarkupAmount), { bold: true });
    }
  }
  w.spacer(10);
  w.divider();

  // --- Plant — independent of any sheet, no markup (Labour, Plant &
  // Material AI Extraction / Task 1.1) ---
  w.subheading(`Plant (${plant.length})`);
  if (plant.length === 0) {
    w.text("No plant attached.");
  } else {
    for (const plantItem of plant) {
      w.row(
        `${plantItem.description} — ${Number(plantItem.quantity)} ${plantItem.unit} @ ${formatCurrency(Number(plantItem.unitCost))}`,
        formatCurrency(Number(plantItem.quantity) * Number(plantItem.unitCost))
      );
    }
    w.row("Plant total", formatCurrency(computePlantCost(plant)), { bold: true });
  }
  w.spacer(10);
  w.divider();

  // --- Grand total (Task 1.1 — unchanged) ---
  w.subheading("Grand total");
  w.row("Labour", formatCurrency(packageTotals.labourTotal));
  w.row("Materials", formatCurrency(packageTotals.materialsTotal));
  w.row("Materials markup", formatCurrency(packageTotals.materialsMarkupTotal));
  w.row("Plant", formatCurrency(packageTotals.plantTotal));
  w.spacer(4);
  w.row("Grand total claimed value", formatCurrency(packageTotals.grandTotal), { bold: true });

  w.spacer(20);
  w.text(`Generated by ${generatedByName} on ${formatDate(new Date())}`, { size: 8, color: [0.5, 0.5, 0.55] });

  // ============================================================
  // From here on: the real, embedded evidence bundle (Task 1.2-1.6),
  // strictly in the order the task specifies.
  // ============================================================

  // --- 1.2 Quote ---
  if (item.quoteFileName && item.quoteStorageKey) {
    await embedSourceFile(w, { fileName: item.quoteFileName, storageKey: item.quoteStorageKey }, `Quote — ${item.quoteFileName}`);
  }

  // --- 1.3 Day Works Sheets: real source file for each sheet (labour
  // only now — materials/plant are independent, see below) ---
  for (const sheet of dayWorksSheets) {
    await embedSourceFile(
      w,
      { fileName: sheet.fileName, storageKey: sheet.storageKey, contentType: sheet.contentType },
      `Day Works Sheet — ${sheet.fileName}`
    );
  }

  // --- Materials/Plant receipt/docket photos — independent of any sheet
  // (Labour, Plant & Material AI Extraction). A single uploaded invoice
  // or docket can produce several line items that all reference the SAME
  // photoStorageKey (see the labour-plant-material save route) — embed
  // each distinct source image once, not once per line item that shares
  // it, so a 5-line invoice doesn't repeat the same page 5 times.
  const embeddedPhotoKeys = new Set<string>();
  for (const material of materials) {
    if (material.photoFileName && material.photoStorageKey && !embeddedPhotoKeys.has(material.photoStorageKey)) {
      embeddedPhotoKeys.add(material.photoStorageKey);
      await embedSourceFile(
        w,
        { fileName: material.photoFileName, storageKey: material.photoStorageKey, contentType: material.photoContentType },
        `Materials receipt — ${material.photoFileName}`
      );
    }
  }
  for (const plantItem of plant) {
    if (plantItem.photoFileName && plantItem.photoStorageKey && !embeddedPhotoKeys.has(plantItem.photoStorageKey)) {
      embeddedPhotoKeys.add(plantItem.photoStorageKey);
      await embedSourceFile(
        w,
        { fileName: plantItem.photoFileName, storageKey: plantItem.photoStorageKey, contentType: plantItem.photoContentType },
        `Plant docket — ${plantItem.photoFileName}`
      );
    }
  }

  // --- 1.4 Site Instruction evidence: source document, then each correspondence entry ---
  if (item.fileName && item.storageKey) {
    await embedSourceFile(w, { fileName: item.fileName, storageKey: item.storageKey }, `Source document — ${item.fileName}`);
  }

  for (const correspondenceItem of correspondence) {
    await embedCorrespondenceEntry(w, correspondenceItem);
  }

  // --- 1.5 Linked Updates: content, then that update's own photos ---
  for (const update of updates) {
    await embedUpdateEntry(w, update);
  }

  // --- 1.6 Directly-uploaded Photos, each its own full page ---
  for (const photo of photos) {
    await embedSourceFile(w, { fileName: photo.fileName, storageKey: photo.storageKey, contentType: photo.contentType }, `Photo — ${photo.fileName}`);
  }

  const bytes = await doc.save();
  return new Uint8Array(bytes);
}
