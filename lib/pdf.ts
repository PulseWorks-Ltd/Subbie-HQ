import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export async function generatePaymentClaimPdf(params: {
  projectName: string;
  claimNumber: number;
  referenceDate: Date;
  claimedAmount: string;
  statutoryWording: string;
}) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const title = `Payment Claim #${params.claimNumber}`;

  page.drawText(title, {
    x: 50,
    y: 780,
    size: 20,
    font,
    color: rgb(0.08, 0.08, 0.1)
  });

  page.drawText(`Project: ${params.projectName}`, {
    x: 50,
    y: 750,
    size: 12,
    font
  });

  page.drawText(`Reference Date: ${params.referenceDate.toDateString()}`, {
    x: 50,
    y: 730,
    size: 12,
    font
  });

  page.drawText(`Claimed Amount: ${params.claimedAmount}`, {
    x: 50,
    y: 710,
    size: 12,
    font
  });

  page.drawText("Statutory Wording:", {
    x: 50,
    y: 680,
    size: 11,
    font
  });

  page.drawText(params.statutoryWording, {
    x: 50,
    y: 660,
    size: 10,
    font,
    maxWidth: 495
  });

  const pdfBytes = await pdfDoc.save();
  return new Uint8Array(pdfBytes);
}

export async function generateInvoicePdf(params: {
  projectName: string;
  invoiceNumber: number;
  referenceDate: Date;
  amount: string;
}) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  page.drawText(`Invoice #${params.invoiceNumber}`, {
    x: 50,
    y: 780,
    size: 20,
    font,
    color: rgb(0.08, 0.08, 0.1)
  });

  page.drawText(`Project: ${params.projectName}`, {
    x: 50,
    y: 750,
    size: 12,
    font
  });

  page.drawText(`Reference Date: ${params.referenceDate.toDateString()}`, {
    x: 50,
    y: 730,
    size: 12,
    font
  });

  page.drawText(`Amount: ${params.amount}`, {
    x: 50,
    y: 710,
    size: 12,
    font
  });

  const pdfBytes = await pdfDoc.save();
  return new Uint8Array(pdfBytes);
}
