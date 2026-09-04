import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "./prisma";
import { getOrganisationLogo, embedOrganisationLogo, drawLogo } from "./pdf-branding";
import { PdfWriter, MARGIN } from "./pdf-writer";
import { drawPhotoGrid } from "./pdf-images";
import { formatUserName } from "./user-display";
import { getOrganisationMembership } from "./organisation";

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

export function formatQaDocumentNumber(docNumber: number): string {
  return `QA-${String(docNumber).padStart(6, "0")}`;
}

// "Generate QA Document" — compiles a chosen, ordered set of QARecords
// into one PDF, in the exact structure/wording the user specified. Built
// the same way lib/payment-claim-pdf.ts was: PdfWriter + pdf-branding's
// logo helpers; the photo grid comes from the new lib/pdf-images.ts.
export async function generateQaDocumentPdf(params: {
  projectId: string;
  qaRecordIds: string[]; // already in the user's chosen order
  siteAddress: string | null;
  contractReference: string | null;
  docNumber: number;
  generatedByUserId: string;
}): Promise<Uint8Array> {
  const [project, generatedByUser, membership, records] = await Promise.all([
    prisma.project.findUniqueOrThrow({ where: { id: params.projectId }, select: { name: true, organisationId: true } }),
    prisma.user.findUniqueOrThrow({
      where: { id: params.generatedByUserId },
      select: { firstName: true, lastName: true, email: true, jobTitle: true }
    }),
    getOrganisationMembership(params.generatedByUserId),
    prisma.qARecord.findMany({
      where: { id: { in: params.qaRecordIds }, projectId: params.projectId },
      include: { attachments: true }
    })
  ]);

  // findMany with `id IN [...]` doesn't preserve the input array's order —
  // re-sort in memory to match the order the user actually chose, since
  // that's what "Detailed Records ... in chronological/user order" means.
  const recordsById = new Map(records.map((record) => [record.id, record]));
  const orderedRecords = params.qaRecordIds.map((id) => recordsById.get(id)).filter((record): record is NonNullable<typeof record> => Boolean(record));

  const totalPhotos = orderedRecords.reduce((sum, record) => sum + record.attachments.filter((a) => a.contentType?.startsWith("image/")).length, 0);
  const dates = orderedRecords.map((record) => record.date.getTime());
  const earliestDate = dates.length > 0 ? new Date(Math.min(...dates)) : null;
  const latestDate = dates.length > 0 ? new Date(Math.max(...dates)) : null;

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await getOrganisationLogo(project.organisationId);
  const logoImage = await embedOrganisationLogo(doc, logo);

  const w = new PdfWriter(doc, font, boldFont);

  if (logoImage) {
    const { height } = drawLogo(w.page, logoImage, { x: MARGIN, y: w.y, maxWidth: 140, maxHeight: 50 });
    w.y -= height + 10;
  }

  const preparedByName = formatUserName(generatedByUser) ?? generatedByUser.email;
  const companyName = membership?.organisation.name ?? null;
  const positionCompany = [generatedByUser.jobTitle, companyName].filter(Boolean).join(" / ") || "—";
  const preparedBy = companyName ? `${preparedByName} — ${companyName}` : preparedByName;
  const now = new Date();

  w.heading("Quality Assurance Document");
  w.spacer(2);
  w.row("Project", project.name || "—");
  w.row("Contract / Job Reference", params.contractReference || "—");
  w.row("Site Address", params.siteAddress || "—");
  w.row("Prepared by", preparedBy);
  w.row("Document Date", formatDate(now));
  w.row("Document Reference", formatQaDocumentNumber(params.docNumber), { bold: true });
  w.spacer(8);
  w.divider();

  w.subheading("Purpose of this Document");
  w.text(
    "This Quality Assurance Document compiles photographic and written records of work completed on the above project. It is provided for the purpose of demonstrating progress, workmanship, and compliance with the relevant contractual requirements."
  );
  w.spacer(10);

  w.subheading("Summary of Included Records");
  w.spacer(2);
  for (const record of orderedRecords) {
    const description = record.notes?.trim() || record.stage;
    const photoCount = record.attachments.filter((a) => a.contentType?.startsWith("image/")).length;
    w.row(`${formatDate(record.date)} — ${description}`, `${photoCount} photo${photoCount === 1 ? "" : "s"}`, { size: 9 });
  }
  w.spacer(4);
  w.row("Total updates included", String(orderedRecords.length), { bold: true });
  w.row("Total photographs", String(totalPhotos), { bold: true });
  w.row("Period covered", earliestDate && latestDate ? `${formatDate(earliestDate)} to ${formatDate(latestDate)}` : "—", { bold: true });
  w.spacer(10);
  w.divider();

  w.subheading("Detailed Records");
  w.spacer(4);
  for (const [index, record] of orderedRecords.entries()) {
    w.ensureSpace(60);
    w.heading(`Update ${index + 1} – ${formatDate(record.date)}`);
    w.text(record.notes?.trim() || record.stage || "No description provided.");
    w.spacer(4);

    const photos = record.attachments
      .filter((attachment) => attachment.contentType?.startsWith("image/"))
      .map((attachment) => ({ storageKey: attachment.storageKey, fileName: attachment.fileName, contentType: attachment.contentType }));
    await drawPhotoGrid(w, doc, photos);

    // Non-image evidence (a scanned PDF, a docx report) attached to the
    // same record isn't part of the photo grid — noted by name rather
    // than silently dropped, since it's still real evidence on the record.
    const otherFiles = record.attachments.filter((attachment) => !attachment.contentType?.startsWith("image/"));
    if (otherFiles.length > 0) {
      w.text(`Also attached: ${otherFiles.map((f) => f.fileName).join(", ")}`, { size: 8, color: [0.45, 0.45, 0.5] });
    }
    w.spacer(14);
  }

  w.divider();
  w.subheading("Declaration");
  w.text(
    "I confirm that the photographs and descriptions contained in this document are true and accurate records of the work undertaken on the dates shown."
  );
  w.spacer(8);
  w.row("Name", preparedByName);
  w.row("Position / Company", positionCompany);
  w.spacer(6);
  w.ensureSpace(30);
  w.page.drawLine({
    start: { x: MARGIN, y: w.y },
    end: { x: MARGIN + 220, y: w.y },
    thickness: 0.5,
    color: rgb(0.3, 0.3, 0.35)
  });
  w.text("Signature", { size: 8, color: [0.5, 0.5, 0.55] });
  w.row("Date", formatDate(now));
  w.spacer(10);
  w.divider();

  w.subheading("Notes");
  w.text("This document is generated from site records held within Subbie HQ.", { size: 9 });
  w.text("Original high-resolution photographs are retained by the authoring party.", { size: 9 });
  w.text(
    "This document does not constitute a formal Producer Statement or Code Compliance Certificate unless separately issued.",
    { size: 9 }
  );
  w.spacer(10);
  w.text("End of Document", { size: 9, bold: true });

  return doc.save();
}
