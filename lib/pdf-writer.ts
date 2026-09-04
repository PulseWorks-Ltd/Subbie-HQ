import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";

// Shared pagination-aware text layout, extracted out of what was
// originally lib/variation-package-pdf.ts's own private PdfWriter class —
// Pre-Launch Feature 5 (a new Payment Claim PDF generator) needed the
// exact same primitives (headings, label/value rows, wrapped body text,
// dividers, page-break handling, WinAnsi sanitization), and copying that
// ~200 lines a second time would leave two copies of the sanitization
// logic that already caused one real production crash (see sanitizeForPdf
// below) to drift out of sync. Every PDF generator in this app should
// build on this one writer, not its own.

export const PAGE_WIDTH = 595.28;
export const PAGE_HEIGHT = 841.89;
export const MARGIN = 50;
export const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
// The app's own brand blue (matches --primary/#137fec in the live product).
export const ACCENT: [number, number, number] = [0.075, 0.498, 0.925];
export const ACCENT_TINT: [number, number, number] = [0.91, 0.95, 0.99];

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
export function sanitizeForPdf(font: PDFFont, text: string): string {
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
export class PdfWriter {
  doc: PDFDocument;
  font: PDFFont;
  boldFont: PDFFont;
  page: PDFPage;
  y: number;
  // Every navigation point recorded during generation — one entry per
  // markOutline()/markContentsSectionOnly() call, in document order.
  // Serves two purposes that mostly, but not entirely, overlap: the real
  // PDF outline/bookmark tree (every `sidebar: true` entry) and a printed
  // Contents page's page-range rows (every `contents: true` entry). A
  // generator that doesn't need either just never calls these two.
  outline: { title: string; page: PDFPage; contents: boolean; sidebar: boolean }[] = [];

  constructor(doc: PDFDocument, font: PDFFont, boldFont: PDFFont) {
    this.doc = doc;
    this.font = font;
    this.boldFont = boldFont;
    this.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  markOutline(title: string, opts: { contents?: boolean } = {}) {
    this.outline.push({ title, page: this.page, contents: opts.contents ?? false, sidebar: true });
  }

  markContentsSectionOnly(title: string) {
    this.outline.push({ title, page: this.page, contents: true, sidebar: false });
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

  // Wraps across as many lines as needed instead of a single drawText call
  // — a long filename or Site Instruction title used to run straight off
  // the page edge with no indication anything was cut off.
  heading(text: string) {
    text = sanitizeForPdf(this.boldFont, text);
    const lines = this.wrap(text, this.boldFont, 14, CONTENT_WIDTH);
    this.ensureSpace(lines.length * 19 + 8);
    for (const line of lines) {
      this.page.drawText(line, { x: MARGIN, y: this.y, size: 14, font: this.boldFont, color: rgb(0.05, 0.08, 0.12) });
      this.y -= 19;
    }
    this.y -= 3;
  }

  subheading(text: string) {
    text = sanitizeForPdf(this.boldFont, text);
    this.ensureSpace(20);
    this.page.drawText(text, { x: MARGIN, y: this.y, size: 11, font: this.boldFont, color: rgb(0.1, 0.1, 0.12) });
    this.y -= 16;
  }

  // Splits on real line breaks FIRST, then word-wraps each line
  // independently — splitting the entire input on /\s+/ before rejoining
  // silently flattens every paragraph break into one run-on wall of text.
  // An empty line is preserved as a blank line (paragraph gap), not
  // collapsed away.
  text(text: string, opts: { size?: number; bold?: boolean; indent?: number; color?: [number, number, number] } = {}) {
    const size = opts.size ?? 10;
    const font = opts.bold ? this.boldFont : this.font;
    const indent = opts.indent ?? 0;
    const color = opts.color ? rgb(...opts.color) : rgb(0.15, 0.15, 0.18);
    // Split on the RAW newline before sanitizing, not after — pdf-lib's
    // widthOfTextAtSize (what canEncode probes) doesn't treat "\n" as an
    // encodable WinAnsi glyph, so sanitizing the whole blob first would
    // silently strip every line break before this method ever splits on them.
    for (const rawLine of text.split("\n")) {
      if (!rawLine.trim()) {
        this.ensureSpace(size + 5);
        this.y -= size + 5;
        continue;
      }
      const lines = this.wrap(sanitizeForPdf(font, rawLine), font, size, CONTENT_WIDTH - indent);
      for (const line of lines) {
        this.ensureSpace(size + 5);
        this.page.drawText(line, { x: MARGIN + indent, y: this.y, size, font, color });
        this.y -= size + 5;
      }
    }
  }

  row(left: string, right: string, opts: { bold?: boolean; indent?: number; size?: number; color?: [number, number, number] } = {}) {
    const size = opts.size ?? 10;
    this.ensureSpace(size + 5);
    const font = opts.bold ? this.boldFont : this.font;
    const indent = opts.indent ?? 0;
    const color = opts.color ? rgb(...opts.color) : rgb(0.15, 0.15, 0.18);
    left = sanitizeForPdf(font, left);
    right = sanitizeForPdf(font, right);
    this.page.drawText(left, { x: MARGIN + indent, y: this.y, size, font, color });
    const rightWidth = font.widthOfTextAtSize(right, size);
    this.page.drawText(right, {
      x: PAGE_WIDTH - MARGIN - rightWidth,
      y: this.y,
      size,
      font,
      color
    });
    this.y -= size + 5;
  }

  spacer(height = 10) {
    this.y -= height;
  }

  divider(opts: { color?: [number, number, number]; thickness?: number } = {}) {
    this.ensureSpace(12);
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_WIDTH - MARGIN, y: this.y },
      thickness: opts.thickness ?? 0.5,
      color: opts.color ? rgb(...opts.color) : rgb(0.85, 0.87, 0.9)
    });
    this.y -= 12;
  }

  // A light tinted panel behind the block the caller draws between —
  // used for a grand total, so the one number a reader most needs is
  // impossible to miss on a page that's otherwise plain black-on-white.
  panelRect(topY: number, height: number, color: [number, number, number] = ACCENT_TINT) {
    this.page.drawRectangle({
      x: MARGIN - 12,
      y: topY - height,
      width: CONTENT_WIDTH + 24,
      height,
      color: rgb(...color)
    });
  }
}
