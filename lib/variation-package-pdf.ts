import { PDFDocument, PDFFont, PDFImage, PDFName, PDFPage, PDFString, StandardFonts, rgb } from "pdf-lib";
import { loadImage, createCanvas } from "@napi-rs/canvas";
import type {
  Correspondence,
  DayWorksMaterial,
  DayWorksPlant,
  DayWorksSheet,
  DayWorksSheetRecord,
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
import { getOrganisationLogo, embedOrganisationLogo, drawLogo } from "./pdf-branding";
import {
  computeSheetRecordTotal,
  computeLabourSummary,
  computeMaterialsSummary,
  computePlantCost,
  computePackageTotals
} from "./variation-package";
import { PdfWriter, sanitizeForPdf, PAGE_WIDTH, PAGE_HEIGHT, MARGIN, CONTENT_WIDTH, ACCENT, ACCENT_TINT } from "./pdf-writer";

function formatCurrency(amount: number) {
  return amount.toLocaleString("en-NZ", { style: "currency", currency: "NZD" });
}

function formatDate(date: Date | null | undefined) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
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

// Fits an image into the space BELOW a given y (rather than centred on a
// blank page) so a caption can sit directly above it on the same page —
// see embedSourceFile, which used to spend one entire near-blank page on
// just the caption before the image even started.
function drawImageFittedBelow(page: PDFPage, image: PDFImage, topY: number) {
  const availWidth = PAGE_WIDTH - MARGIN * 2;
  const availHeight = topY - MARGIN;
  const scale = Math.min(availWidth / image.width, availHeight / image.height, 1);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  page.drawImage(image, {
    x: (PAGE_WIDTH - drawWidth) / 2,
    y: topY - drawHeight,
    width: drawWidth,
    height: drawHeight
  });
}

// Targeted cleanup for the specific clutter seen in a real forwarded
// email rendered into a package: raw tracking/attachment URLs written as
// "label[https://...]" or "label<https://...>" by the sending mail
// client. Strips just the bracketed/angle-bracketed URL itself, keeping
// the surrounding human text — never touches a URL that isn't wrapped
// this way, so a genuine plain-text link a person typed is left alone.
function cleanEmailBodyForPdf(body: string): string {
  return body
    .replace(/\[https?:\/\/[^\]]+\]/gi, "")
    .replace(/<https?:\/\/[^>]+>/gi, "")
    .replace(/<mailto:[^>]+>/gi, "")
    .replace(/[ \t]+\n/g, "\n") // trailing spaces left behind by a stripped link
    .replace(/\n{3,}/g, "\n\n"); // collapse any resulting run of blank lines
}

// The core "embed real content, or fall back gracefully" primitive every
// evidence type in this file goes through (Task 1.7) — a PDF's actual
// pages are copied in (real content, not a rasterised screenshot, per
// Task 2.2); an image is embedded full-page, downscaling first if it's
// unusually large (Task 2.4); anything else — an unrecognised file type,
// a download failure, a corrupt/encrypted PDF pdf-lib can't parse — falls
// through to a placeholder notice rather than failing the whole
// generation.
//
// An IMAGE's caption is drawn directly above the image on the SAME page
// — this used to always burn one separate, almost entirely blank page
// per photo/dayworks-sheet-scan just for a one-line label before the real
// content even started (confirmed in a real 14-page package: roughly a
// third of its pages were exactly this). A copied real PDF still gets its
// own short divider page first, since we can't safely draw our own
// caption on top of someone else's actual document content without
// risking obscuring it — that divider now also says how many pages
// follow, so it's a useful transition, not just dead space.
async function embedSourceFile(
  w: PdfWriter,
  file: { fileName: string; storageKey: string; contentType?: string | null },
  heading: string,
  opts: { contentsSection?: string } = {}
): Promise<void> {
  // Every branch below draws `heading` (now a meaningful label like "Day
  // Works Sheet 3 of 5", never the raw uploaded filename — Task 3.3: a
  // real generated package used to head every one of these pages with
  // something like "2026.08 - St Lukes - B20 - SI-250 (DWS).pdf", which
  // tells a reader nothing about what they're looking at or how many more
  // follow it) then records the outline entry and, underneath, the
  // original filename itself at a small size — so that detail isn't lost,
  // just demoted from the heading to a caption.
  function markHeadingAndOutline() {
    w.markOutline(heading);
    if (opts.contentsSection) w.markContentsSectionOnly(opts.contentsSection);
    w.text(file.fileName, { size: 8, color: [0.5, 0.5, 0.55] });
  }

  try {
    const kind = resolveEmbedKind(file.fileName, file.contentType);
    if (kind === "unknown") {
      throw new Error(`Unsupported file type for "${file.fileName}"`);
    }

    const bytes = await downloadFromS3(file.storageKey);

    if (kind === "pdf") {
      const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const pageCount = srcDoc.getPageCount();
      w.newPage();
      w.heading(heading);
      markHeadingAndOutline();
      w.text(`${pageCount} page${pageCount === 1 ? "" : "s"} follow${pageCount === 1 ? "s" : ""} — the original document, unaltered.`, {
        size: 9,
        color: [0.45, 0.45, 0.5]
      });
      const copiedPages = await w.doc.copyPages(srcDoc, srcDoc.getPageIndices());
      for (const page of copiedPages) {
        w.doc.addPage(page);
      }
    } else {
      const image = await embedImageSmart(w.doc, bytes, kind);
      const page = w.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      w.page = page;
      w.y = PAGE_HEIGHT - MARGIN;
      w.heading(heading);
      markHeadingAndOutline();
      drawImageFittedBelow(page, image, w.y);
    }
  } catch {
    w.newPage();
    w.heading(heading);
    markHeadingAndOutline();
    w.text(`"${file.fileName}" could not be embedded inline in this package.`, { bold: true, color: [0.6, 0.15, 0.15] });
    w.text("The original file remains available in Subbie HQ under this item's evidence.");
  }
}

function renderTextEvidencePage(
  w: PdfWriter,
  opts: { heading: string; meta: { label: string; value: string }[]; body: string; contentsSection?: string }
) {
  w.newPage();
  w.heading(opts.heading);
  w.markOutline(opts.heading);
  if (opts.contentsSection) w.markContentsSectionOnly(opts.contentsSection);
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
async function embedCorrespondenceEntry(w: PdfWriter, item: CorrespondenceWithRelations, contentsSection?: string): Promise<void> {
  const kind = resolveEmbedKind(item.fileName, null);
  if (item.fileName && item.storageKey && kind !== "unknown") {
    await embedSourceFile(w, { fileName: item.fileName, storageKey: item.storageKey }, `Correspondence — ${item.title}`, { contentsSection });
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
    renderTextEvidencePage(w, {
      heading: `Correspondence — ${item.inboundEmail.subject}`,
      meta,
      body: cleanEmailBodyForPdf(item.inboundEmail.body),
      contentsSection
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
      body: cleanEmailBodyForPdf(item.sourceUpdate.externalBody ?? ""),
      contentsSection
    });
    return;
  }

  // Covers response_letter_draft AND — new — external_action (a Request
  // Approval/Sign/etc link): that source's own message plus any response
  // summary is stored directly on this row's bodyText (see
  // lib/external-action.ts), but nothing above ever read it, so every
  // external_action entry fell straight to the "no content" fallback
  // below regardless of whether it actually had something to show.
  // Confirmed in a real generated package: two "Approve requested from
  // ...@nss.co.nz" entries rendered as bare "No file or content
  // available" pages despite the request having been sent with a real
  // drafted message.
  if (item.bodyText && item.bodyText.trim()) {
    renderTextEvidencePage(w, {
      heading: `Correspondence — ${item.title}`,
      meta: [{ label: "Date", value: formatDate(item.createdAt) }],
      body: item.bodyText,
      contentsSection
    });
    return;
  }

  // Genuinely nothing to show (e.g. an "upload"-source row whose file has
  // since gone missing) — the cover page's Correspondence list already
  // names this entry, so skip spending a whole page on a page that would
  // only say "no content" and add it back here.
}

type UpdateWithRelations = Update & {
  author: Pick<User, "firstName" | "lastName" | "email">;
  attachments: UpdateAttachment[];
};

// Task 1.5 — an Update's real content followed immediately by any photos
// attached to that same Update. Externally-sent updates show the actual
// emailed subject/body (externalSubject/externalBody), the human-reviewed
// final content, not the author's original rough draft in `body`.
async function embedUpdateEntry(w: PdfWriter, update: UpdateWithRelations, contentsSection?: string): Promise<void> {
  const wasSentExternally = update.isExternal && update.externalSentAt;
  renderTextEvidencePage(w, {
    heading: wasSentExternally ? `Update — ${update.externalSubject ?? "Sent update"}` : "Update",
    meta: [
      { label: "Date", value: formatDate(wasSentExternally ? update.externalSentAt : update.createdAt) },
      { label: "Author", value: formatUserName(update.author) ?? update.author.email }
    ],
    body: cleanEmailBodyForPdf((wasSentExternally ? update.externalBody : update.body) || update.body),
    contentsSection
  });

  for (let i = 0; i < update.attachments.length; i++) {
    const attachment = update.attachments[i];
    await embedSourceFile(
      w,
      { fileName: attachment.fileName, storageKey: attachment.storageKey, contentType: attachment.contentType },
      `Update photo ${i + 1} of ${update.attachments.length}`
    );
  }
}

// Inserts a short, page-numbered Contents index as the document's second
// page, right after the cover (Task 3.2). Section boundaries are exactly
// the markOutline(..., { contents: true }) calls recorded while the rest
// of the document was being written, in the order they were recorded —
// which is document order, since each one fires right as its own heading
// is actually drawn. A section's printed range then just runs from its
// own start page to one page before the NEXT section's start (or to the
// document's last page, for the final section) — no separate grouping
// logic needed, because the sections are already contiguous by
// construction (each evidence type is written as one unbroken run).
function insertContentsPage(doc: PDFDocument, w: PdfWriter) {
  const sections = w.outline.filter((entry) => entry.contents);
  if (sections.length === 0) return;

  // Captured BEFORE inserting the Contents page itself, so these are
  // stable 0-based positions in the pre-insertion page list.
  const pagesBeforeInsert = doc.getPages();
  // Index 0 is the cover page, which the Contents page is inserted
  // immediately after (doc.insertPage(1, ...)) — it isn't shifted by that
  // insertion. Everything from index 1 onward moves one page later.
  const toDisplayNumber = (index: number) => (index === 0 ? 1 : index + 2);

  const rows = sections.map((section, i) => {
    const startIndex = pagesBeforeInsert.indexOf(section.page);
    const nextStartIndex = i < sections.length - 1 ? pagesBeforeInsert.indexOf(sections[i + 1].page) : pagesBeforeInsert.length;
    const endIndex = Math.max(startIndex, nextStartIndex - 1);
    return { title: section.title, startPage: toDisplayNumber(startIndex), endPage: toDisplayNumber(endIndex) };
  });

  const contentsPage = doc.insertPage(1, [PAGE_WIDTH, PAGE_HEIGHT]);
  w.page = contentsPage;
  w.y = PAGE_HEIGHT - MARGIN;
  w.heading("Contents");
  w.spacer(4);
  w.divider();
  w.spacer(6);
  for (const row of rows) {
    const label = row.startPage === row.endPage ? `Page ${row.startPage}` : `Pages ${row.startPage}–${row.endPage}`;
    w.row(row.title, label);
  }

  // The Contents page gets its own bookmark too, spliced in right after
  // the cover page's own entry (index 0) so the sidebar's ordering
  // matches the document's actual physical page order.
  w.outline.splice(1, 0, { title: "Contents", page: contentsPage, contents: false, sidebar: true });
}

// Builds a real navigable PDF outline (bookmark) tree from every
// markOutline() call recorded during generation (Task 3.1). pdf-lib has no
// built-in outline/bookmark API, so this uses its low-level object
// primitives directly (context.nextRef/assign/obj and the document's own
// public `catalog`) rather than add a bookmark-specific dependency for
// what's fundamentally a short, fixed structure: a flat doubly-linked list
// of dictionaries hung off the document's /Outlines catalog entry.
// PageMode is set to UseOutlines too, so a viewer opens with that sidebar
// already showing rather than the reader having to know to look for it.
function attachOutline(doc: PDFDocument, boldFont: PDFFont, entries: { title: string; page: PDFPage }[]) {
  if (entries.length === 0) return;

  const context = doc.context;
  // Reserved up front, not yet registered to an object — each item's dict
  // needs to reference its Prev/Next sibling's ref, and at least one of
  // those two directions is always a forward reference no matter what
  // order the dicts are built in, since this is a doubly-linked list.
  const itemRefs = entries.map(() => context.nextRef());
  const rootRef = context.nextRef();

  entries.forEach((entry, i) => {
    const dict: Record<string, unknown> = {
      // context.obj() converts a plain JS string into a PDFName, not a
      // PDFString — correct for /Type and /Fit below, but a bookmark's
      // Title must genuinely be a string object, so it's wrapped
      // explicitly. Run through the same WinAnsi-safe sanitizer as
      // on-page text, since a title built from free text (a filename, an
      // item title) could contain the exact class of character that has
      // already crashed a real PDF generation once in this file.
      Title: PDFString.of(sanitizeForPdf(boldFont, entry.title)),
      Parent: rootRef,
      Dest: [entry.page.ref, "Fit"]
    };
    if (i > 0) dict.Prev = itemRefs[i - 1];
    if (i < entries.length - 1) dict.Next = itemRefs[i + 1];
    // context.obj()'s LiteralObject type doesn't accept a loosely-typed
    // Record<string, unknown> even though every value here genuinely is a
    // valid Literal | PDFObject at runtime (a PDFString, a PDFRef, or a
    // [PDFRef, string] array) — this is low-level interop with pdf-lib's
    // own internal object-construction API, not application logic, so the
    // cast is deliberate rather than a type-safety gap being papered over.
    context.assign(itemRefs[i], context.obj(dict as any));
  });

  context.assign(
    rootRef,
    context.obj({
      Type: "Outlines",
      First: itemRefs[0],
      Last: itemRefs[itemRefs.length - 1],
      Count: entries.length
    })
  );

  doc.catalog.set(PDFName.of("Outlines"), rootRef);
  doc.catalog.set(PDFName.of("PageMode"), PDFName.of("UseOutlines"));
}

export async function generateVariationPackagePdf(params: {
  item: VariationItem;
  photos: VariationPhoto[];
  correspondence: CorrespondenceWithRelations[];
  dayWorksSheets: DayWorksSheet[];
  sheetRecords: DayWorksSheetRecord[];
  materials: DayWorksMaterial[];
  plant: DayWorksPlant[];
  updates: UpdateWithRelations[];
  contractTerms: { materialsMarkupPercent: number | null } | null;
  generatedByName: string;
  organisationId?: string | null;
}): Promise<Uint8Array> {
  const { item, photos, correspondence, dayWorksSheets, sheetRecords, materials, plant, updates, contractTerms, generatedByName } = params;

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const w = new PdfWriter(doc, font, boldFont);

  // Org logo, top-right corner of the cover page only — deliberately drawn
  // independently of PdfWriter's own y-cursor (not folded into the header
  // below) so adding it can't disturb this file's already-tuned vertical
  // layout math anywhere else.
  const logo = await getOrganisationLogo(params.organisationId ?? null);
  const logoImage = await embedOrganisationLogo(doc, logo);
  if (logoImage) {
    drawLogo(w.page, logoImage, { x: PAGE_WIDTH - MARGIN - 110, y: PAGE_HEIGHT - MARGIN + 12, maxWidth: 110, maxHeight: 40 });
  }

  const packageTotals = computePackageTotals(sheetRecords, materials, plant, contractTerms);

  // --- Header (Task 1.1) ---
  w.heading(`Variation Package — ${item.reference}`);
  w.markOutline(`Variation Package — ${item.reference}`);
  w.text(item.title, { size: 13, bold: true });
  w.spacer(6);
  // Accent-coloured rule marking the masthead off from the detail rows
  // below it — the only other spot in this document besides the grand
  // total that uses the brand colour, so it reads as a deliberate accent
  // rather than a rebrand of every line.
  w.divider({ color: ACCENT, thickness: 1.5 });
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
  w.markOutline("Evidence included", { contents: true });
  w.text(
    `Photos (${photos.length}), Correspondence (${correspondence.length}), Day Works Sheets (${sheetRecords.length}), Materials (${materials.length}), Plant (${plant.length})`
  );
  w.spacer(10);
  w.divider();

  // --- Photos thumbnail grid (unchanged from before this feature — the
  // full-page standalone Photos embed happens later, see Task 1.6) ---
  w.subheading(`Photos (${photos.length})`);
  if (photos.length > 0) w.markOutline(`Photos (${photos.length})`, { contents: true });
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
  if (correspondence.length > 0) w.markOutline(`Correspondence (${correspondence.length})`, { contents: true });
  if (correspondence.length === 0) {
    w.text("No correspondence attached.");
  } else {
    for (const item2 of correspondence) {
      w.text(`${formatDate(item2.createdAt)} — ${item2.title} (${item2.source})`);
    }
  }
  w.spacer(10);
  w.divider();

  // --- Day Works Sheets computed breakdown — a flat labour record list
  // now (Labour joined Materials/Plant in becoming independent of any
  // specific sheet — see DayWorksSheetRecord's schema comment), not
  // grouped by source file; each uploaded file's real content still
  // embeds separately below (Task 1.3). Matches how Materials/Plant list
  // their own line items flatly rather than grouped by source document. ---
  w.subheading(`Day Works Sheets — Labour (${sheetRecords.length})`);
  if (sheetRecords.length > 0) w.markOutline(`Day Works Sheets — Labour (${sheetRecords.length})`, { contents: true });
  if (sheetRecords.length === 0) {
    w.text("No labour records attached.");
  } else {
    for (const record of sheetRecords) {
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
      w.row(description, total != null ? formatCurrency(total) : "—");
    }
    const labour = computeLabourSummary(sheetRecords);
    w.row("Labour total", formatCurrency(labour.total), { bold: true });
  }
  w.spacer(10);
  w.divider();

  // --- Materials — independent of any sheet (Labour, Plant & Material AI
  // Extraction) ---
  w.subheading(`Materials (${materials.length})`);
  if (materials.length > 0) w.markOutline(`Materials (${materials.length})`, { contents: true });
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
  if (plant.length > 0) w.markOutline(`Plant (${plant.length})`, { contents: true });
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

  // --- Grand total ---
  // Reserves room for the WHOLE section (heading + 4 rows + the total
  // panel + the generated-by line) up front, so it moves to a fresh page
  // as one block rather than the panel alone splitting away onto a
  // near-empty page by itself when the cover page is almost, but not
  // quite, full — which is exactly what the new panel's extra height
  // caused before this reservation was added.
  w.ensureSpace(165);
  w.subheading("Grand total");
  w.markOutline("Grand total", { contents: true });
  w.row("Labour", formatCurrency(packageTotals.labourTotal));
  w.row("Materials", formatCurrency(packageTotals.materialsTotal));
  w.row("Materials markup", formatCurrency(packageTotals.materialsMarkupTotal));
  w.row("Plant", formatCurrency(packageTotals.plantTotal));
  w.spacer(8);

  // The one number a Main Contractor's QS actually needs, set apart in a
  // tinted panel and the brand colour at a larger size — previously this
  // was styled identically to every other line item on the page (just
  // bold), easy to scroll straight past.
  w.ensureSpace(44);
  const totalPanelTop = w.y + 10;
  w.panelRect(totalPanelTop, 34);
  w.row("GRAND TOTAL CLAIMED VALUE", formatCurrency(packageTotals.grandTotal), {
    bold: true,
    size: 15,
    color: ACCENT,
    indent: 8
  });
  w.spacer(10);

  w.spacer(10);
  w.text(`Generated by ${generatedByName} on ${formatDate(new Date())}`, { size: 8, color: [0.5, 0.5, 0.55] });

  // ============================================================
  // From here on: the real, embedded evidence bundle (Task 1.2-1.6),
  // strictly in the order the task specifies.
  // ============================================================

  // --- 1.2 Quote ---
  if (item.quoteFileName && item.quoteStorageKey) {
    await embedSourceFile(w, { fileName: item.quoteFileName, storageKey: item.quoteStorageKey }, "Quote", { contentsSection: "Quote" });
  }

  // --- 1.3 Day Works Sheets: real source file for each sheet (labour
  // only now — materials/plant are independent, see below). Headed by
  // position ("Day Works Sheet 2 of 5"), not the raw uploaded filename —
  // Task 3.3 — with the original filename still shown, just demoted to a
  // caption underneath (see embedSourceFile).
  for (let i = 0; i < dayWorksSheets.length; i++) {
    const sheet = dayWorksSheets[i];
    await embedSourceFile(
      w,
      { fileName: sheet.fileName, storageKey: sheet.storageKey, contentType: sheet.contentType },
      `Day Works Sheet ${i + 1} of ${dayWorksSheets.length}`,
      { contentsSection: i === 0 ? "Day Works Sheets" : undefined }
    );
  }

  // --- Materials/Plant receipt/docket photos — independent of any sheet
  // (Labour, Plant & Material AI Extraction). A single uploaded invoice
  // or docket can produce several line items that all reference the SAME
  // photoStorageKey (see the labour-plant-material save route) — embed
  // each distinct source image once, not once per line item that shares
  // it, so a 5-line invoice doesn't repeat the same page 5 times. Collected
  // into a list first (rather than embedding inline) so each one can be
  // numbered "N of M" against the real de-duplicated count, not the raw
  // materials/plant array length.
  const embeddedPhotoKeys = new Set<string>();
  const materialPhotoEntries: { fileName: string; storageKey: string; contentType: string | null }[] = [];
  for (const material of materials) {
    if (material.photoFileName && material.photoStorageKey && !embeddedPhotoKeys.has(material.photoStorageKey)) {
      embeddedPhotoKeys.add(material.photoStorageKey);
      materialPhotoEntries.push({ fileName: material.photoFileName, storageKey: material.photoStorageKey, contentType: material.photoContentType });
    }
  }
  for (let i = 0; i < materialPhotoEntries.length; i++) {
    await embedSourceFile(w, materialPhotoEntries[i], `Materials receipt ${i + 1} of ${materialPhotoEntries.length}`, {
      contentsSection: i === 0 ? "Materials Receipts" : undefined
    });
  }

  const plantPhotoEntries: { fileName: string; storageKey: string; contentType: string | null }[] = [];
  for (const plantItem of plant) {
    if (plantItem.photoFileName && plantItem.photoStorageKey && !embeddedPhotoKeys.has(plantItem.photoStorageKey)) {
      embeddedPhotoKeys.add(plantItem.photoStorageKey);
      plantPhotoEntries.push({ fileName: plantItem.photoFileName, storageKey: plantItem.photoStorageKey, contentType: plantItem.photoContentType });
    }
  }
  for (let i = 0; i < plantPhotoEntries.length; i++) {
    await embedSourceFile(w, plantPhotoEntries[i], `Plant docket ${i + 1} of ${plantPhotoEntries.length}`, {
      contentsSection: i === 0 ? "Plant Dockets" : undefined
    });
  }

  // --- 1.4 Site Instruction evidence: source document, then each correspondence entry ---
  if (item.fileName && item.storageKey) {
    await embedSourceFile(w, { fileName: item.fileName, storageKey: item.storageKey }, "Source document", { contentsSection: "Source document" });
  }

  // contentsSection is only attached to the first correspondence entry
  // that actually produces a page — some entries render nothing at all
  // (see embedCorrespondenceEntry's final fallback), so "first in the
  // array" isn't necessarily "first that lands on a page"; tracked here
  // via whether a new outline entry actually appeared.
  let correspondenceSectionMarked = false;
  for (const correspondenceItem of correspondence) {
    const outlineCountBefore = w.outline.length;
    await embedCorrespondenceEntry(w, correspondenceItem, correspondenceSectionMarked ? undefined : "Correspondence");
    if (w.outline.length > outlineCountBefore) correspondenceSectionMarked = true;
  }

  // --- 1.5 Linked Updates: content, then that update's own photos ---
  for (let i = 0; i < updates.length; i++) {
    await embedUpdateEntry(w, updates[i], i === 0 ? "Updates" : undefined);
  }

  // --- 1.6 Directly-uploaded Photos, each its own full page ---
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    await embedSourceFile(w, { fileName: photo.fileName, storageKey: photo.storageKey, contentType: photo.contentType }, `Photo ${i + 1} of ${photos.length}`, {
      contentsSection: i === 0 ? "Photos" : undefined
    });
  }

  // --- Contents index + PDF outline/bookmarks (Task 3.1/3.2) — inserted
  // after all real content exists (a page-number/Dest can't be computed or
  // linked before then) but BEFORE the footer pass below, so the newly
  // inserted Contents page gets a footer and a correct "Page X of Y" too. ---
  insertContentsPage(doc, w);
  // Only sidebar-visible entries become real bookmarks — the appendix's
  // generic section-start markers (Task 3.2's "Day Works Sheets" etc.)
  // exist purely to compute the Contents page's page ranges and would
  // otherwise sit right next to (and duplicate) the specific per-item
  // bookmark that already covers that same page.
  attachOutline(doc, boldFont, w.outline.filter((entry) => entry.sidebar));

  // --- Footer on every page: small logo mark, item reference, and
  // "Page X of Y" — previously only the cover page ever said who
  // generated this or when, and nothing anywhere said how many pages the
  // package even ran to. Run as a final pass over every page (including
  // ones copied wholesale from an embedded source PDF) since the total
  // page count isn't known until generation is complete. ---
  const allPages = doc.getPages();
  const totalPages = allPages.length;
  allPages.forEach((page, index) => {
    const footerY = 26;
    if (logoImage) {
      drawLogo(page, logoImage, { x: MARGIN, y: footerY + 14, maxWidth: 14, maxHeight: 14 });
    }
    const refLabel = sanitizeForPdf(font, item.reference);
    page.drawText(refLabel, { x: MARGIN + (logoImage ? 20 : 0), y: footerY, size: 8, font, color: rgb(0.55, 0.57, 0.6) });
    const pageLabel = `Page ${index + 1} of ${totalPages}`;
    const pageLabelWidth = font.widthOfTextAtSize(pageLabel, 8);
    page.drawText(pageLabel, {
      x: PAGE_WIDTH - MARGIN - pageLabelWidth,
      y: footerY,
      size: 8,
      font,
      color: rgb(0.55, 0.57, 0.6)
    });
  });

  const bytes = await doc.save();
  return new Uint8Array(bytes);
}
