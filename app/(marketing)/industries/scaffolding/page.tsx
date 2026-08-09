import type { Metadata } from "next";
import { IndustryPageView } from "@/components/marketing/industry-page-view";

export const metadata: Metadata = {
  title: "Contract & Commercial Management for Scaffolding Contractors | Subbie HQ",
  description: "Subbie HQ helps scaffolding subcontractors capture verbal instructions, hire extensions, and variations before they become disputed invoices."
};

export default function ScaffoldingPage() {
  return (
    <IndustryPageView
      h1={`"Leave It Up Another Week."`}
      heroHook={`One verbal instruction on site, and three weeks later you're arguing over an invoice nobody remembers agreeing to.`}
      reality={`The builder asks to leave the scaffold up "for another week." Three weeks later it's still there. Nobody's issued a hire extension. Nobody's approved the extra cost. When the invoice arrives, everyone suddenly remembers the conversation differently — and you're the one carrying the gear, and the cost, in the meantime.`}
      lossScenarios={[
        `Hire periods extended verbally, with no written approval ever issued`,
        `Additional lifts or loading platforms requested on site, never formally instructed`,
        `Site access restrictions increasing labour, with no variation raised`,
        `Weather or crane delays creating extra visits that never get claimed`,
        `Components damaged or gone missing, with no photo evidence to back a claim`,
        `Dismantling delayed by another trade, with no record of who caused it`
      ]}
      contractRequirements={`Many scaffold subcontracts require written notice before a hire period is extended, or a formal instruction before additional scope like extra lifts or platforms is priced and carried out. Exactly what's required — and by when — depends on your specific contract, so this isn't a substitute for reading yours. What's consistent across almost every contract: the earlier something is written down, the stronger your position when it's disputed later.`}
      howWeHelp={[
        `Log the instruction the moment it's given, from your phone, on site`,
        `Photograph damaged, lost, or extended equipment as evidence`,
        `Record additional labour and hire time via Day Works Sheets`,
        `Keep every email and site conversation in one Correspondence trail`
      ]}
      workflow={`Instruction given on site → logged as an Update → tagged to the relevant Site Instruction or Variation → photos and Day Works attached as the work happens → bundled into a Variation Package when it's time to claim.`}
      whyItMatters={`A missed hire extension or an unclaimed extra lift doesn't feel like much on its own. Across a year of jobs, it's real, recoverable money you're quietly writing off.`}
    />
  );
}
