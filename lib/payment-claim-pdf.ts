import { PDFDocument, StandardFonts } from "pdf-lib";
import { prisma } from "./prisma";
import { getPaymentClaimComputedData } from "./payment-claim";
import { getOrganisationLogo, embedOrganisationLogo, drawLogo, measureLogoSize } from "./pdf-branding";
import { PdfWriter, MARGIN, PAGE_WIDTH, ACCENT, ACCENT_TINT } from "./pdf-writer";

function formatCurrency(amount: number) {
  return amount.toLocaleString("en-NZ", { style: "currency", currency: "NZD" });
}
function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}
function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}
function round2(value: number) {
  return Math.round(value * 100) / 100;
}

// Generates the Payment Claim PDF as four labelled sections, matching the
// real, formal SA-2017 Subcontractor's Payment Claim Schedule the user
// actually submits — Appendix B1 (summary), B2 (original contract works),
// B3 (variations), and a conditional Hire Schedule page (only rendered
// when the schedule actually contains a weekly_hire item — scaffolding-
// style claims only). Each section starts on its own page. Named
// distinctly from lib/pdf.ts's OWN generatePaymentClaimPdf — that one
// belongs to a dead, pre-VariationPackage legacy route (see that route's
// own comment) and is left untouched, not revived. This is the real, live
// generator.
export async function generatePaymentClaimAppendixB1Pdf(projectId: string, claimId: string): Promise<Uint8Array> {
  const data = await getPaymentClaimComputedData(projectId, claimId);
  if (!data) {
    throw new Error("Payment claim not found.");
  }

  const [organisation, mainContractor] = await Promise.all([
    data.organisationId
      ? prisma.organisation.findUnique({ where: { id: data.organisationId }, select: { name: true, address: true, gstNumber: true, trade: true } })
      : null,
    data.mainContractorId ? prisma.mainContractor.findUnique({ where: { id: data.mainContractorId }, select: { name: true, address: true } }) : null
  ]);

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await getOrganisationLogo(data.organisationId);
  const logoImage = await embedOrganisationLogo(doc, logo);

  const w = new PdfWriter(doc, font, boldFont);

  // ============================================================
  // Appendix B1 – Payment Claim Summary
  // ============================================================

  // Logo top-right (moved from top-left per the user's request) — the
  // heading sits top-left on the SAME row, so the two need to clear
  // whichever of them is taller before anything else is drawn.
  const startY = w.y;
  let logoBottomY = startY;
  if (logoImage) {
    const size = measureLogoSize(logoImage, 140, 50);
    drawLogo(w.page, logoImage, { x: PAGE_WIDTH - MARGIN - size.width, y: startY, maxWidth: 140, maxHeight: 50 });
    logoBottomY = startY - size.height - 10;
  }
  w.heading("Payment Claim");
  w.y = Math.min(w.y, logoBottomY);
  w.spacer(4);

  // FROM / TO blocks — stacked (not side-by-side): simpler and more
  // robust than hand-rolled two-column text with pdf-lib's plain
  // drawText primitives, while still containing everything asked for.
  w.subheading("From");
  w.text(organisation?.name ?? "Subcontractor", { bold: true });
  if (organisation?.address) w.text(organisation.address);
  if (organisation?.gstNumber) w.text(`GST No: ${organisation.gstNumber}`, { size: 9 });
  w.spacer(6);

  w.subheading("To");
  w.text(mainContractor?.name ?? "Main Contractor", { bold: true });
  if (mainContractor?.address) w.text(mainContractor.address);
  w.spacer(8);
  w.divider();

  w.row("Project", data.projectName || "—");
  w.row("Location", data.projectSiteAddress || "—");
  w.row("Trade", organisation?.trade || "—");
  w.row("Job No.", data.projectJobNumber || "—");
  w.row("Payment Claim No.", String(data.claim.claimNumber));
  w.row("Claim period", `${formatDate(data.claim.periodStart)} – ${formatDate(data.claim.periodEnd)}`);
  w.row("Reference / Claim date", formatDate(data.claim.referenceDate));
  w.spacer(6);
  w.text(data.claim.statutoryWording, { size: 9, bold: true, color: [0.3, 0.35, 0.4] });
  w.spacer(10);
  w.divider();

  const f = data.figures;
  w.subheading("Claim Summary");
  w.spacer(4);
  w.row("1.  Original Subcontract Sum", formatCurrency(f.originalSubcontractSum));
  w.row("2.  Approved Variations", formatCurrency(f.approvedVariationsTotal));
  w.row("3.  Revised Subcontract Sum", formatCurrency(f.revisedSubcontractSum), { bold: true });
  w.spacer(4);
  w.row("4.  Variations submitted awaiting approval", formatCurrency(f.variationsAwaitingApproval));
  w.row("5.  Value of original Subcontract Sum claimed to date (refer Appendix B2)", formatCurrency(f.scheduleClaimedToDate));
  w.row("6.  Value of approved variations claimed to date (refer Appendix B3)", formatCurrency(f.variationsClaimedToDate));
  w.row("7.  Value of variations waiting for approval (refer Appendix B3)", formatCurrency(f.variationsAwaitingApprovalToDate));
  w.row("8.  Value of fluctuations (if applicable)", formatCurrency(f.fluctuations));
  w.row("9.  Value of materials on-site and off-site", formatCurrency(f.materialsOnOffSite));
  w.row("10. Gross claim to date", formatCurrency(f.grossClaimToDate), { bold: true });
  w.row("11. Less retention", `(${formatCurrency(f.retention)})`);
  w.row("12. Net claim to date", formatCurrency(f.netClaimToDate), { bold: true });
  w.row("13. Less previous payment claims / Agreed Progress Payment Certificates", `(${formatCurrency(f.previousClaimsNet)})`);
  w.row("14. Net amount for this claim", formatCurrency(f.thisClaimNet), { bold: true });
  w.row("15. Plus GST", formatCurrency(f.gst));

  w.spacer(4);
  w.ensureSpace(44);
  const totalPanelTop = w.y + 10;
  w.panelRect(totalPanelTop, 34, ACCENT_TINT);
  w.row("16. Gross amount for this claim (incl. GST)", formatCurrency(f.thisClaimGrossInclGst), { bold: true, size: 12, color: ACCENT, indent: 8 });
  w.spacer(12);

  // ============================================================
  // Appendix B2 – Original Contract Works
  // ============================================================
  w.newPage();
  w.heading("Appendix B2 – Original Contract Works");
  w.spacer(4);

  if (!data.hasSchedule || data.scheduleBreakdown.length === 0) {
    w.text("No Contract Schedule exists for this project.");
  } else {
    for (const item of data.scheduleBreakdown) {
      w.ensureSpace(30);
      const itemTotal = item.components.reduce((sum, c) => sum + c.totalValue, 0);
      w.row(item.description, `Total ${formatCurrency(itemTotal)}`, { bold: true, size: 10 });

      const erectDismantle = item.components.filter((c) => c.kind === "fixed");
      const hire = item.components.filter((c) => c.kind === "weekly_hire");

      // Only show a group sub-heading when the item genuinely mixes both
      // kinds — a single-kind item just lists its components directly,
      // matching how the app's own Contract Schedule view already
      // presents a component list without forcing an extra heading.
      const showGroupLabels = erectDismantle.length > 0 && hire.length > 0;

      if (erectDismantle.length > 0) {
        if (showGroupLabels) w.text("Erect & Dismantle", { size: 8.5, bold: true, indent: 4, color: [0.45, 0.45, 0.5] });
        for (const component of erectDismantle) {
          w.row(
            `  ${component.label}`,
            `Previous ${formatCurrency(component.previousClaimedToDate)}   This claim ${formatCurrency(component.thisClaimAmount)}   To date ${formatCurrency(component.claimedToDate)}`,
            { size: 8.5 }
          );
        }
      }
      if (hire.length > 0) {
        if (showGroupLabels) w.text("Hire", { size: 8.5, bold: true, indent: 4, color: [0.45, 0.45, 0.5] });
        for (const component of hire) {
          w.row(
            `  ${component.label}`,
            `Previous ${formatCurrency(component.previousClaimedToDate)}   This claim ${formatCurrency(component.thisClaimAmount)}   To date ${formatCurrency(component.claimedToDate)}`,
            { size: 8.5 }
          );
        }
      }
      w.spacer(6);
    }
  }

  // ============================================================
  // Appendix B3 – Variations
  // ============================================================
  w.newPage();
  w.heading("Appendix B3 – Variations");
  w.spacer(4);

  if (data.variations.length === 0) {
    w.text("No Variations exist on this project.");
  } else {
    for (const variation of data.variations) {
      w.ensureSpace(28);
      const percentClaimed = variation.value > 0 ? (variation.totalAllocatedAcrossAllClaims / variation.value) * 100 : 0;
      w.row(
        `${variation.reference} — ${variation.title}${variation.closed ? " (closed)" : ""}`,
        `Submitted ${formatCurrency(variation.value)}`,
        { bold: true, size: 9.5 }
      );
      w.row(
        `  Approved: ${variation.approved ? formatCurrency(variation.value) : "—"}`,
        `${formatPercent(percentClaimed)} claimed to date`,
        { size: 8.5 }
      );
      w.row(`  This claim ${formatCurrency(variation.thisClaimAmount)}`, `Total claimed to date ${formatCurrency(variation.totalAllocatedAcrossAllClaims)}`, {
        size: 8.5
      });
      w.spacer(6);
    }
  }

  // ============================================================
  // Hire Schedule — only when at least one weekly_hire item exists
  // ============================================================
  const hireComponents = data.scheduleBreakdown.flatMap((item) =>
    item.components.filter((c) => c.kind === "weekly_hire").map((component) => ({ item, component }))
  );

  if (hireComponents.length > 0) {
    w.newPage();
    w.heading("Hire Schedule");
    w.spacer(4);
    w.text(`For the period ${formatDate(data.claim.periodStart)} – ${formatDate(data.claim.periodEnd)}`, { size: 9, color: [0.4, 0.4, 0.45] });
    w.spacer(6);

    for (const { item, component } of hireComponents) {
      w.ensureSpace(40);
      w.text(`${item.description} — ${component.label}`, { bold: true, size: 9.5 });
      w.row(
        `  Days on hire this period: ${component.daysOnHireThisPeriod}`,
        `% on hire (at period end): ${formatPercent(component.percentOnHireAtPeriodEnd)}`,
        { size: 8.5 }
      );
      w.row(`  Weekly rate: ${formatCurrency(component.weeklyRate)}`, `Daily rate: ${formatCurrency(round2(component.weeklyRate / 7))}`, {
        size: 8.5
      });
      w.row(`  Amount this claim: ${formatCurrency(component.thisClaimAmount)}`, `Running total: ${formatCurrency(component.claimedToDate)}`, {
        size: 8.5
      });
      w.spacer(8);
    }
  }

  return doc.save();
}
