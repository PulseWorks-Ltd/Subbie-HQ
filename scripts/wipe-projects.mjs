// Deletes every Project and everything that hangs off it (contract
// documents, clauses, reviews, scope, programme, variations, payment
// claims, invoices, evidence, correspondence, updates, safety documents,
// monthly work records) — a clean slate for re-populating jobs from
// scratch. Deliberately does NOT touch: User, Organisation,
// OrganisationMember, OrganisationInvite, MainContractor,
// MainContractorContact, InsuranceCertificate, InsuranceCertificateCover —
// your login, org, Main Contractors/contacts, and insurance certificates
// all survive this untouched.
//
// Runs against whatever DATABASE_URL is set when invoked — use the guarded
// npm scripts rather than running this directly:
//   npm run db:staging:wipe-projects   (test it here first)
//   npm run db:prod:wipe-projects      (guarded by scripts/check-db-target.js)
//
// Every table below only ever contains project-scoped rows (verified
// against prisma/schema.prisma), so deleteMany() with no filter is
// equivalent to "delete everything under any project." Order matters —
// children before parents, respecting every foreign key in the schema —
// and the whole thing runs as one transaction so a mistake anywhere aborts
// the entire wipe rather than leaving a half-deleted mess.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Leaf-most first. Comment on each line notes what still points at it.
const DELETE_ORDER = [
  ["contractDeviation", "ContractReview"],
  ["updateAttachment", "Update"],
  ["dayWorksSheet", "VariationItem"],
  ["variationPhoto", "VariationItem"],
  ["scopeProgrammeLink", "ScopeItem + ProgrammeItem"],
  ["evidenceScopeItem", "Evidence + ScopeItem"],
  ["evidenceProgrammeItem", "Evidence + ProgrammeItem"],
  ["evidencePaymentClaim", "Evidence + PaymentClaim"],
  ["correspondence", "Project (+ references ContractReview/ContractDocument/VariationItem/InboundEmail)"],
  ["update", "Project (+ self-referencing replies, references VariationItem)"],
  ["contractReview", "ContractDocument (after ContractDeviation + Correspondence cleared)"],
  ["contractTerms", "ContractDocument (sourceDocumentId)"],
  ["contractRequiredCover", "ContractDocument (sourceDocumentId)"],
  ["scopeItem", "ContractDocument + Clause (sourceClauseId) — before Clause"],
  ["programmeItem", "ContractDocument"],
  ["clause", "ContractDocument — after ScopeItem cleared"],
  ["contractDocument", "Project — after Clause/ScopeItem/ProgrammeItem/ContractReview/ContractTerms/ContractRequiredCover/Correspondence cleared"],
  ["variationItem", "Project — after DayWorksSheet/VariationPhoto/Correspondence/Update cleared"],
  ["evidence", "Project — after EvidenceScopeItem/EvidenceProgrammeItem/EvidencePaymentClaim cleared"],
  ["paymentClaim", "Project — after EvidencePaymentClaim cleared"],
  ["invoice", "Project"],
  ["monthlyWorkRecord", "Project"],
  ["variation", "Project (legacy model, no children)"],
  ["inboundEmail", "Project — after Evidence + Correspondence cleared"],
  ["safetyDocument", "Project"],
  ["insuranceDistribution", "Project + InsuranceCertificate (kept) — just the join record"],
  ["projectContact", "Project + MainContractorContact (kept) — just the join record"],
  ["projectMember", "Project"],
  ["project", "(root)"]
];

async function main() {
  console.log(`Connecting to: ${new URL(process.env.DATABASE_URL).host}\n`);

  const counts = {};
  for (const [model] of DELETE_ORDER) {
    counts[model] = await prisma[model].count();
  }
  console.log("Rows about to be deleted:");
  for (const [model, dependents] of DELETE_ORDER) {
    console.log(`  ${model.padEnd(24)} ${String(counts[model]).padStart(6)}   (referenced by/via: ${dependents})`);
  }
  const totalRows = Object.values(counts).reduce((a, b) => a + b, 0);
  if (totalRows === 0) {
    console.log("\nNothing to delete — already clean.");
    await prisma.$disconnect();
    return;
  }
  console.log(`\nTotal: ${totalRows} rows across ${DELETE_ORDER.length} tables. Deleting now...\n`);

  await prisma.$transaction(
    DELETE_ORDER.map(([model]) => prisma[model].deleteMany()),
    { timeout: 60_000 }
  );

  console.log("Done. Verifying...");
  for (const [model] of DELETE_ORDER) {
    const remaining = await prisma[model].count();
    if (remaining !== 0) {
      throw new Error(`${model} still has ${remaining} row(s) — this should never happen inside a committed transaction.`);
    }
  }
  const [userCount, orgCount, mcCount, certCount] = await Promise.all([
    prisma.user.count(),
    prisma.organisation.count(),
    prisma.mainContractor.count(),
    prisma.insuranceCertificate.count()
  ]);
  console.log("All project data deleted. Kept untouched:");
  console.log(`  users: ${userCount}, organisations: ${orgCount}, main contractors: ${mcCount}, insurance certificates: ${certCount}`);
  console.log("\nReady for populating — S3 files referenced by the deleted rows are now orphaned but not deleted (out of scope for this script).");

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error("\nWipe failed — transaction rolled back, no data was deleted:\n", error);
  await prisma.$disconnect();
  process.exit(1);
});
