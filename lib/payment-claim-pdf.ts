import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "./prisma";
import { getPaymentClaimComputedData } from "./payment-claim";
import { getOrganisationLogo, embedOrganisationLogo, drawLogo } from "./pdf-branding";
import { PdfWriter, MARGIN, ACCENT, ACCENT_TINT } from "./pdf-writer";

function formatCurrency(amount: number) {
  return amount.toLocaleString("en-NZ", { style: "currency", currency: "NZD" });
}
function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

// Pre-Launch Feature 5 — generates a Payment Claim PDF matching the
// official SA-2017 Appendix B1 payment claim schedule's own numbered
// structure (see lib/standard-forms/sa-2017.json, clauseRef 1-16 under
// "Appendices B1-B4: Payment & Variation Claim Forms") — every row number
// and its exact label below is taken straight from that real template,
// not invented, so a Main Contractor's QS who already knows the SA-2017
// form recognises this immediately. Rows this app genuinely doesn't model
// as their own concept (variations awaiting approval, fluctuations,
// materials on/off site) print as $0 rather than being silently dropped —
// the row still exists on a real SA-2017 claim even when unused.
// Named distinctly from lib/pdf.ts's OWN generatePaymentClaimPdf — that
// one belongs to a dead, pre-VariationPackage legacy route
// (app/api/projects/[projectId]/payment-claims/generate) that isn't
// called by any real UI (see that route's own comment) and is left
// untouched, not revived. This is the real, live generator.
export async function generatePaymentClaimAppendixB1Pdf(projectId: string, claimId: string): Promise<Uint8Array> {
  const data = await getPaymentClaimComputedData(projectId, claimId);
  if (!data) {
    throw new Error("Payment claim not found.");
  }

  const [organisation, mainContractor] = await Promise.all([
    data.organisationId ? prisma.organisation.findUnique({ where: { id: data.organisationId }, select: { name: true } }) : null,
    data.mainContractorId ? prisma.mainContractor.findUnique({ where: { id: data.mainContractorId }, select: { name: true } }) : null
  ]);

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await getOrganisationLogo(data.organisationId);
  const logoImage = await embedOrganisationLogo(doc, logo);

  const w = new PdfWriter(doc, font, boldFont);

  if (logoImage) {
    const { height } = drawLogo(w.page, logoImage, { x: MARGIN, y: w.y, maxWidth: 140, maxHeight: 50 });
    w.y -= height + 10;
  }

  w.heading("Payment Claim");
  w.text(
    `${organisation?.name ?? "Subcontractor"}  →  ${mainContractor?.name ?? "Main Contractor"}`,
    { bold: true, size: 11 }
  );
  w.spacer(4);
  w.row("Project", data.projectName || "—");
  w.row("Payment Claim No.", String(data.claim.claimNumber));
  w.row("Claim period", `${formatDate(data.claim.periodStart)} – ${formatDate(data.claim.periodEnd)}`);
  w.row("Reference date", formatDate(data.claim.referenceDate));
  w.spacer(6);
  w.text(data.claim.statutoryWording, { size: 9, color: [0.3, 0.35, 0.4] });
  w.spacer(10);
  w.divider();

  const f = data.figures;
  w.subheading("Claim Summary — Appendix B1");
  w.spacer(4);
  w.row("1.  Original Subcontract Sum", formatCurrency(f.originalSubcontractSum));
  w.row("2.  Approved variations", formatCurrency(f.approvedVariationsTotal));
  w.row("3.  Revised Subcontract Sum", formatCurrency(f.revisedSubcontractSum), { bold: true });
  w.spacer(4);
  w.row("4.  Variations submitted awaiting approval", formatCurrency(f.variationsAwaitingApproval));
  w.row("5.  Value of original Subcontract Sum claimed to date", formatCurrency(f.scheduleClaimedToDate));
  w.row("6.  Value of approved variations claimed to date", formatCurrency(f.variationsClaimedToDate));
  w.row("7.  Value of variations waiting for approval", formatCurrency(f.variationsAwaitingApprovalToDate));
  w.row("8.  Value of fluctuations (if applicable)", formatCurrency(f.fluctuations));
  w.row("9.  Value of materials on-site and off-site", formatCurrency(f.materialsOnOffSite));
  w.row("10. Gross claim to date", formatCurrency(f.grossClaimToDate), { bold: true });
  w.row("11. Less retentions", `(${formatCurrency(f.retention)})`);
  w.row("12. Net claim to date", formatCurrency(f.netClaimToDate), { bold: true });
  w.row("13. Less previous payment claims", `(${formatCurrency(f.previousClaimsNet)})`);
  w.row("14. Net amount for this claim", formatCurrency(f.thisClaimNet), { bold: true });
  w.row("15. Plus GST", formatCurrency(f.gst));

  w.spacer(4);
  w.ensureSpace(44);
  const totalPanelTop = w.y + 10;
  w.panelRect(totalPanelTop, 34, ACCENT_TINT);
  w.row("16. Gross amount for this claim (incl. GST)", formatCurrency(f.thisClaimGrossInclGst), { bold: true, size: 12, color: ACCENT, indent: 8 });
  w.spacer(12);

  if (data.hasSchedule && data.scheduleBreakdown.length > 0) {
    w.divider();
    w.subheading("Original Contract Works — from the Contract Schedule");
    w.spacer(2);
    for (const item of data.scheduleBreakdown) {
      w.text(item.description, { bold: true, size: 9 });
      for (const component of item.components) {
        w.row(
          `  ${component.label}`,
          `Previous ${formatCurrency(component.previousClaimedToDate)}   This claim ${formatCurrency(component.thisClaimAmount)}   To date ${formatCurrency(component.claimedToDate)}`,
          { size: 8.5 }
        );
      }
    }
    w.spacer(8);
  }

  if (data.variations.length > 0) {
    w.divider();
    w.subheading("Variations");
    w.spacer(2);
    for (const variation of data.variations) {
      w.row(
        `${variation.reference} — ${variation.title}${variation.closed ? " (closed)" : ""}`,
        `This claim ${formatCurrency(variation.thisClaimAmount)}   To date ${formatCurrency(variation.totalAllocatedAcrossAllClaims)}`,
        { size: 8.5 }
      );
    }
  }

  return doc.save();
}
