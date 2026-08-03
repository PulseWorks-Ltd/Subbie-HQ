import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import type { Correspondence, VariationItem, VariationPhoto } from "@prisma/client";
import { downloadFromS3 } from "./s3";
import {
  computeSheetRecordTotal,
  computeSheetTotals,
  computePackageTotals,
  type DayWorksSheetWithLineItems
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
    this.ensureSpace(28);
    this.page.drawText(text, { x: MARGIN, y: this.y, size: 14, font: this.boldFont, color: rgb(0.05, 0.08, 0.12) });
    this.y -= 22;
  }

  subheading(text: string) {
    this.ensureSpace(20);
    this.page.drawText(text, { x: MARGIN, y: this.y, size: 11, font: this.boldFont, color: rgb(0.1, 0.1, 0.12) });
    this.y -= 16;
  }

  text(text: string, opts: { size?: number; bold?: boolean; indent?: number; color?: [number, number, number] } = {}) {
    const size = opts.size ?? 10;
    const font = opts.bold ? this.boldFont : this.font;
    const indent = opts.indent ?? 0;
    const color = opts.color ? rgb(...opts.color) : rgb(0.15, 0.15, 0.18);
    const lines = this.wrap(text, font, size, CONTENT_WIDTH - indent);
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

export async function generateVariationPackagePdf(params: {
  item: VariationItem;
  photos: VariationPhoto[];
  correspondence: Correspondence[];
  dayWorksSheets: DayWorksSheetWithLineItems[];
  contractTerms: { materialsMarkupPercent: number | null } | null;
  generatedByName: string;
}): Promise<Uint8Array> {
  const { item, photos, correspondence, dayWorksSheets, contractTerms, generatedByName } = params;

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const w = new PdfWriter(doc, font, boldFont);

  const packageTotals = computePackageTotals(dayWorksSheets, contractTerms);

  // --- Header ---
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
    `Photos (${photos.length}), Correspondence (${correspondence.length}), Day Works Sheets (${dayWorksSheets.length})`
  );
  w.spacer(10);
  w.divider();

  // --- Photos ---
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
      const caption = photo.fileName.length > 18 ? `${photo.fileName.slice(0, 15)}...` : photo.fileName;
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

  // --- Correspondence ---
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

  // --- Day Works Sheets ---
  w.subheading(`Day Works Sheets (${dayWorksSheets.length})`);
  if (dayWorksSheets.length === 0) {
    w.text("No Day Works Sheets attached.");
  }
  for (const sheet of dayWorksSheets) {
    const totals = computeSheetTotals(sheet, contractTerms);
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
      w.row("Labour total", formatCurrency(totals.labour.total), { bold: true, indent: 10 });
    }

    if (sheet.materials.length > 0) {
      w.text("Materials:", { bold: true, indent: 10 });
      for (const material of sheet.materials) {
        w.row(
          `${material.description} — ${Number(material.quantity)} ${material.unit} @ ${formatCurrency(Number(material.unitCost))}`,
          formatCurrency(Number(material.quantity) * Number(material.unitCost)),
          { indent: 16 }
        );
      }
      w.row("Materials total", formatCurrency(totals.materialsCost), { indent: 10 });
      if (totals.materialsMarkupAmount > 0) {
        w.row("Materials markup", formatCurrency(totals.materialsMarkupAmount), { indent: 10 });
      }
    }

    if (sheet.plant.length > 0) {
      w.text("Plant:", { bold: true, indent: 10 });
      for (const plantItem of sheet.plant) {
        w.row(
          `${plantItem.description} — ${Number(plantItem.quantity)} ${plantItem.unit} @ ${formatCurrency(Number(plantItem.unitCost))}`,
          formatCurrency(Number(plantItem.quantity) * Number(plantItem.unitCost)),
          { indent: 16 }
        );
      }
      w.row("Plant total", formatCurrency(totals.plantCost), { indent: 10 });
    }

    w.row("Sheet total", formatCurrency(totals.combinedTotal), { bold: true });
    w.spacer(6);
  }

  w.divider();

  // --- Grand total ---
  w.subheading("Grand total");
  w.row("Labour", formatCurrency(packageTotals.labourTotal));
  w.row("Materials", formatCurrency(packageTotals.materialsTotal));
  w.row("Materials markup", formatCurrency(packageTotals.materialsMarkupTotal));
  w.row("Plant", formatCurrency(packageTotals.plantTotal));
  w.spacer(4);
  w.row("Grand total claimed value", formatCurrency(packageTotals.grandTotal), { bold: true });

  w.spacer(20);
  w.text(`Generated by ${generatedByName} on ${formatDate(new Date())}`, { size: 8, color: [0.5, 0.5, 0.55] });

  const bytes = await doc.save();
  return new Uint8Array(bytes);
}
