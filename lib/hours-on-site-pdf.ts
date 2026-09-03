import { PDFDocument, PDFFont, StandardFonts, rgb } from "pdf-lib";
import { formatUserName } from "./user-display";
import { downloadFromS3 } from "./s3";
import { getOrganisationLogo, embedOrganisationLogo, drawLogo } from "./pdf-branding";
import type { getSheetWithDetail } from "./hours-on-site";

// Same WinAnsi-encodability guard as variation-package-pdf.ts (see that
// file's own comment — a zero-width space in real user text crashed PDF
// generation in production once already). Worker names, comments, and the
// self-attested approver name are all free text a user typed, so this
// file needs the same protection, not just the one that already had it.
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
function sanitizeForPdf(font: PDFFont, text: string): string {
  let result = "";
  for (const char of text) {
    result += canEncode(font, char) ? char : "";
  }
  return result;
}

// Matches the DWS reference templates' own convention (docs/Standard
// Documents/DWS 01 Template.jpg, DWS 02 Template.pdf) — a short prefix
// plus a zero-padded number, e.g. "DWS-000123". The underlying number
// itself (HoursOnSiteSheet.dayWorksSheetNumber) is a plain global
// autoincrement — this is purely a display convention on top of it.
export function formatDayWorksSheetNumber(n: number): string {
  return `DWS-${String(n).padStart(6, "0")}`;
}

// Maps the Prisma getSheetWithDetail() shape into generateHoursOnSitePdf's
// params — the one place that translation happens, reused by both the
// download route and the email route so they can never drift apart.
export function paramsFromSheet(sheet: NonNullable<Awaited<ReturnType<typeof getSheetWithDetail>>>) {
  return {
    projectName: sheet.project.name,
    organisationId: sheet.project.organisationId,
    organisationName: sheet.project.organisation?.name ?? null,
    dayWorksSheetNumber: sheet.dayWorksSheetNumber,
    variationItemReference: sheet.variationItem?.reference ?? null,
    variationItemTitle: sheet.variationItem?.title ?? null,
    comments: sheet.comments,
    startedAt: sheet.startedAt,
    finishedAt: sheet.finishedAt,
    totalHours: sheet.totalHours != null ? Number(sheet.totalHours) : null,
    workerNames: sheet.workers.map((w) => w.worker.name),
    createdByName: formatUserName(sheet.createdByUser) ?? sheet.createdByUser.email,
    approvedAt: sheet.approvedAt,
    approvedByName: sheet.approvedByName,
    signatureImageStorageKey: sheet.signatureImageStorageKey
  };
}

// Generated fresh every time it's needed (viewed, emailed, or opened from
// a secure approval link) from the sheet's CURRENT data — deliberately
// not a stored/frozen file, since hours/workers/comments must stay
// editable until approved (see HoursOnSiteSheet's schema comment). Once
// approved the sheet is locked, so a regeneration after that point always
// reproduces the exact same bytes anyway.
//
// Laid out along the lines of a traditional pre-printed dayworks pad (see
// docs/Standard Documents/DWS 01 Template.jpg and DWS 02 Template.pdf) —
// a boxed header with the sheet number top-right, a work-description
// block, a start/finish/total-hours strip, and a signature block at the
// bottom — rather than the plain label/value list this used to be.
export async function generateHoursOnSitePdf(params: {
  projectName: string;
  organisationId: string | null;
  organisationName: string | null;
  dayWorksSheetNumber: number;
  variationItemReference: string | null;
  variationItemTitle: string | null;
  comments: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  totalHours: number | null;
  workerNames: string[];
  createdByName: string;
  approvedAt: Date | null;
  approvedByName: string | null;
  signatureImageStorageKey: string | null;
}) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const pageWidth = 595.28;
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const ink = rgb(0.08, 0.08, 0.1);
  const muted = rgb(0.4, 0.4, 0.45);
  const line = rgb(0.82, 0.84, 0.87);

  const left = 50;
  const right = pageWidth - 50;
  let y = 792;

  // --- Header: logo (if set) top-left, title + sheet number top-right ---
  const logo = await getOrganisationLogo(params.organisationId);
  const logoImage = await embedOrganisationLogo(pdfDoc, logo);
  let headerLeftBottom = y;
  if (logoImage) {
    const { height } = drawLogo(page, logoImage, { x: left, y: y + 8, maxWidth: 110, maxHeight: 48 });
    headerLeftBottom = y + 8 - height;
  }
  if (params.organisationName) {
    const name = sanitizeForPdf(boldFont, params.organisationName);
    page.drawText(name, { x: left, y: headerLeftBottom - 14, size: 11, font: boldFont, color: ink });
  }

  const title = "DAYWORKS SHEET";
  const titleWidth = boldFont.widthOfTextAtSize(title, 18);
  page.drawText(title, { x: right - titleWidth, y, size: 18, font: boldFont, color: ink });
  const sheetNo = formatDayWorksSheetNumber(params.dayWorksSheetNumber);
  const sheetNoWidth = boldFont.widthOfTextAtSize(sheetNo, 13);
  page.drawText(sheetNo, { x: right - sheetNoWidth, y: y - 22, size: 13, font: boldFont, color: rgb(0.55, 0.15, 0.15) });

  y -= 60;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: line });
  y -= 20;

  function labelValue(label: string, value: string, x: number, width: number) {
    page.drawText(label.toUpperCase(), { x, y, size: 8, font: boldFont, color: muted });
    page.drawText(sanitizeForPdf(font, value), { x, y: y - 13, size: 11, font, color: ink, maxWidth: width });
  }

  const colWidth = (right - left - 20) / 2;
  labelValue("Project", params.projectName, left, colWidth);
  labelValue(
    "Date",
    params.startedAt.toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "short", year: "numeric" }),
    left + colWidth + 20,
    colWidth
  );
  y -= 38;
  labelValue(
    "Site instruction",
    params.variationItemReference ? `${params.variationItemReference} — ${params.variationItemTitle ?? ""}` : "Not linked to an SI",
    left,
    colWidth
  );
  labelValue("Recorded by", params.createdByName, left + colWidth + 20, colWidth);
  y -= 38;

  // --- Description of work ---
  page.drawText("DESCRIPTION OF WORK", { x: left, y, size: 8, font: boldFont, color: muted });
  y -= 4;
  const descBoxTop = y;
  const descBoxHeight = 60;
  page.drawRectangle({ x: left, y: descBoxTop - descBoxHeight, width: right - left, height: descBoxHeight, borderColor: line, borderWidth: 1 });
  const description = params.comments?.trim() || (params.variationItemTitle ?? "");
  page.drawText(sanitizeForPdf(font, description || "(no description recorded)"), {
    x: left + 8,
    y: descBoxTop - 16,
    size: 10,
    font,
    color: ink,
    maxWidth: right - left - 16,
    lineHeight: 13
  });
  y = descBoxTop - descBoxHeight - 20;

  // --- Start / Finish / Total hours strip (DWS 02's own layout cue) ---
  const timeBoxHeight = 40;
  const timeColWidth = (right - left) / 3;
  const timeLabels: [string, string][] = [
    ["Start time", params.startedAt.toLocaleTimeString("en-NZ", { hour: "2-digit", minute: "2-digit" })],
    ["Finish time", params.finishedAt ? params.finishedAt.toLocaleTimeString("en-NZ", { hour: "2-digit", minute: "2-digit" }) : "Not yet finished"],
    ["Total hours", params.totalHours != null ? `${params.totalHours.toFixed(2)} hrs` : "—"]
  ];
  for (let i = 0; i < 3; i++) {
    const x = left + i * timeColWidth;
    page.drawRectangle({ x, y: y - timeBoxHeight, width: timeColWidth, height: timeBoxHeight, borderColor: line, borderWidth: 1 });
    page.drawText(timeLabels[i][0].toUpperCase(), { x: x + 8, y: y - 14, size: 8, font: boldFont, color: muted });
    page.drawText(timeLabels[i][1], { x: x + 8, y: y - 30, size: 12, font: boldFont, color: ink });
  }
  y -= timeBoxHeight + 20;

  // --- Workers on site ---
  page.drawText("WORKERS ON SITE", { x: left, y, size: 8, font: boldFont, color: muted });
  y -= 16;
  if (params.workerNames.length === 0) {
    page.drawText("(none recorded)", { x: left, y, size: 10, font, color: muted });
    y -= 16;
  } else {
    for (const name of params.workerNames) {
      page.drawText(`•  ${sanitizeForPdf(font, name)}`, { x: left, y, size: 10, font, color: ink });
      y -= 15;
    }
  }
  y -= 12;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: line });
  y -= 24;

  // --- Signature / approval block ---
  page.drawText("APPROVAL", { x: left, y, size: 8, font: boldFont, color: muted });
  y -= 6;

  if (params.approvedAt && params.approvedByName) {
    let signatureBytes: Uint8Array | null = null;
    if (params.signatureImageStorageKey) {
      try {
        signatureBytes = await downloadFromS3(params.signatureImageStorageKey);
      } catch {
        signatureBytes = null;
      }
    }

    if (signatureBytes) {
      try {
        const signatureImage = await pdfDoc.embedPng(signatureBytes);
        const maxWidth = 200;
        const maxHeight = 60;
        const scale = Math.min(maxWidth / signatureImage.width, maxHeight / signatureImage.height, 1);
        const w = signatureImage.width * scale;
        const h = signatureImage.height * scale;
        page.drawImage(signatureImage, { x: left, y: y - 20 - h, width: w, height: h });
        y -= 20 + h + 4;
      } catch {
        // Falls through to the text-only confirmation below.
      }
    }

    const approvedDate = params.approvedAt.toLocaleString("en-NZ");
    page.drawText(sanitizeForPdf(boldFont, params.approvedByName), { x: left, y, size: 12, font: boldFont, color: ink });
    y -= 15;
    page.drawText(`Approved ${approvedDate}`, { x: left, y, size: 9, font, color: muted });
    y -= 14;
    page.drawText("A recorded acknowledgement of what was sent, not a certified electronic signature.", {
      x: left,
      y,
      size: 8,
      font,
      color: muted
    });
    y -= 20;
  } else {
    page.drawText("Not yet approved.", { x: left, y, size: 11, font, color: muted });
    y -= 24;
  }

  page.drawText("Generated by Subbie HQ — supporting evidence for a variation claim.", {
    x: left,
    y: 40,
    size: 9,
    font,
    color: muted
  });

  const pdfBytes = await pdfDoc.save();
  return new Uint8Array(pdfBytes);
}
