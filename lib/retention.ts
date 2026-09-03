import { prisma } from "./prisma";

// ============================================================
// Retention tracking — the release side of Appendix B1's "Less retention"
// line. Total withheld is deliberately NEVER stored: PaymentClaim rows
// (built earlier this session) are already the real, live record of what's
// been claimed, so this always recomputes from them rather than keeping a
// second number that could drift out of sync. See the Retention model's
// own schema comment for the two-tranche design and the deliberately
// deferred retention-cap gap.
// ============================================================

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// The one figure every other calculation here builds on: retentionPercent
// (from ContractTerms) applied to every claim's own claimedAmount, summed.
// A missing retentionPercent means "not yet configured" — treated as 0
// rather than throwing, so this page still renders sensibly before
// Contract Terms has been filled in.
export async function computeTotalRetentionWithheld(projectId: string): Promise<number> {
  const [claims, contractTerms] = await Promise.all([
    prisma.paymentClaim.findMany({ where: { projectId }, select: { claimedAmount: true } }),
    prisma.contractTerms.findUnique({ where: { projectId }, select: { retentionPercent: true } })
  ]);

  const retentionPercent = contractTerms?.retentionPercent ?? 0;
  const total = claims.reduce((sum, claim) => sum + Number(claim.claimedAmount) * (retentionPercent / 100), 0);
  return round2(total);
}

// "Withheld" (above) is the cumulative, historical amount ever deducted
// from a claim — it never goes down, even after a tranche is released
// (matches Appendix B1's own "Less retention" line, a running deduction,
// not a live balance). "Currently held" is the number that actually
// matters when asking "how much of my money does this Main Contractor
// still have" — withheld minus whatever's genuinely been released so far.
export async function computeNetRetentionCurrentlyHeld(projectId: string): Promise<number> {
  const [totalWithheld, retention] = await Promise.all([
    computeTotalRetentionWithheld(projectId),
    prisma.retention.findUnique({
      where: { projectId },
      select: { tranche1ReleasedAmount: true, tranche2ReleasedAmount: true }
    })
  ]);

  const released = Number(retention?.tranche1ReleasedAmount ?? 0) + Number(retention?.tranche2ReleasedAmount ?? 0);
  return round2(totalWithheld - released);
}

// Summed across every project belonging to one Main Contractor — the
// "Exceed" rollup (a subbie running several concurrent jobs with the same
// head contractor wants to see what's currently held across all of them,
// not just one project at a time). Uses the NET figure above, not gross
// withheld, since "currently held" is what a subbie actually wants to
// know here — reuses the identical per-project calculation, just grouped
// differently.
export async function computeTotalRetentionWithheldForMainContractor(mainContractorId: string): Promise<number> {
  const projects = await prisma.project.findMany({ where: { mainContractorId }, select: { id: true } });
  const totals = await Promise.all(projects.map((project) => computeNetRetentionCurrentlyHeld(project.id)));
  return round2(totals.reduce((sum, total) => sum + total, 0));
}

export type RetentionSummary = {
  totalWithheld: number;
  retentionPercent: number;
  practicalCompletionDate: Date | null;
  tranche1: {
    expectedDate: Date | null;
    percent: number | null;
    expectedAmount: number | null;
    releasedAmount: number | null;
    releasedAt: Date | null;
  };
  tranche2: {
    expectedDate: Date | null;
    percent: number | null;
    expectedAmount: number | null;
    releasedAmount: number | null;
    releasedAt: Date | null;
  };
};

// The full picture the Retention card on the Payment Claims page renders —
// one call, everything already resolved (defaults applied, amounts
// computed), so the UI never has to re-derive this logic itself.
export async function getRetentionSummary(projectId: string): Promise<RetentionSummary> {
  const [totalWithheld, contractTerms, retention, project] = await Promise.all([
    computeTotalRetentionWithheld(projectId),
    prisma.contractTerms.findUnique({ where: { projectId }, select: { retentionPercent: true, defectsLiabilityPeriodDays: true } }),
    prisma.retention.findUnique({ where: { projectId } }),
    prisma.project.findUnique({ where: { id: projectId }, select: { completedAt: true } })
  ]);

  const practicalCompletionDate = retention?.practicalCompletionDateOverride ?? project?.completedAt ?? null;

  // Tranche 1's expected date defaults to Practical Completion itself
  // (release is conventionally due AT that milestone, not some period
  // after it) — only meaningful once PC is actually known.
  const tranche1ExpectedDate = retention?.tranche1ExpectedDate ?? practicalCompletionDate;

  // Tranche 2 defaults to tranche 1's date + the contract's Defects
  // Liability Period — computed here, in application code, every time
  // rather than stored, so editing either the DLP length or tranche 1's
  // own date automatically keeps tranche 2's default in step; an explicit
  // tranche2ExpectedDate on the row always overrides this.
  let tranche2ExpectedDate = retention?.tranche2ExpectedDate ?? null;
  if (!tranche2ExpectedDate && tranche1ExpectedDate && contractTerms?.defectsLiabilityPeriodDays != null) {
    tranche2ExpectedDate = new Date(tranche1ExpectedDate);
    tranche2ExpectedDate.setDate(tranche2ExpectedDate.getDate() + contractTerms.defectsLiabilityPeriodDays);
  }

  const tranche1Percent = retention?.tranche1Percent ?? null;
  const tranche2Percent = retention?.tranche2Percent ?? null;

  return {
    totalWithheld,
    retentionPercent: contractTerms?.retentionPercent ?? 0,
    practicalCompletionDate,
    tranche1: {
      expectedDate: tranche1ExpectedDate,
      percent: tranche1Percent,
      expectedAmount: tranche1Percent != null ? round2(totalWithheld * (tranche1Percent / 100)) : null,
      releasedAmount: retention?.tranche1ReleasedAmount != null ? Number(retention.tranche1ReleasedAmount) : null,
      releasedAt: retention?.tranche1ReleasedAt ?? null
    },
    tranche2: {
      expectedDate: tranche2ExpectedDate,
      percent: tranche2Percent,
      expectedAmount: tranche2Percent != null ? round2(totalWithheld * (tranche2Percent / 100)) : null,
      releasedAmount: retention?.tranche2ReleasedAmount != null ? Number(retention.tranche2ReleasedAmount) : null,
      releasedAt: retention?.tranche2ReleasedAt ?? null
    }
  };
}
