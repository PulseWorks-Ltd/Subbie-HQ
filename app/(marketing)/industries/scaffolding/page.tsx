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
      reality={`The tender drawings didn't show it, so nobody priced it. Then a PM asks on site — or sends a Site Instruction — for a birdcage in the double volume void so the ceiling crew can get up there. Nobody signs off the cost before you start. You build it, because the job needs to keep moving. At the end of the month you claim for it. A month after that, you're told the claim's been rejected — and now you're trying to prove, weeks later, who actually asked for it and when, while the PM remembers the conversation differently to you.

It happens the other way too. The external scaffold's finished, signed off, handed over. A month later the PM wants hop-ups installed because the roof design's changed. You install them — it's a small ask, on a job you're already on. You claim it as a variation at month-end. The following month, you're told it's "part of the contract works," not a variation at all, and you're left carrying the cost of scope that didn't even exist when the job was signed off.

Neither story is about whether the work should've been paid for. It's about nobody having a record of what was actually agreed, made, or instructed, at the moment it mattered.`}
      lossScenarios={[
        `Scope missed at tender (a birdcage, an extra lift, an unplanned void) requested verbally or by SI, with work proceeding before any cost is agreed`,
        `Claims for that extra scope rejected weeks or months later, with no timestamped record of who instructed it or when`,
        `Additional work requested after the scaffold's already been signed off and handed over, later disputed as "part of the original contract" rather than a genuine variation`,
        `Hire periods extended verbally, with no written approval ever issued`,
        `Components damaged or gone missing, with no photo evidence to back a claim`,
        `Weather or crane delays creating extra visits that never get claimed`
      ]}
      contractRequirements={`Many scaffold subcontracts require a formal instruction and agreed pricing BEFORE additional work proceeds — not a claim submitted after it's already built. Once a scaffold has been signed off and handed over, anything requested afterward is much easier to argue is genuinely new scope, provided there's a clear record of when handover happened and what changed since. Exactly what your contract requires — and how quickly — is worth checking directly, since this varies. What's consistent: waiting until month-end to write anything down is the single biggest reason these claims get disputed.`}
      howWeHelp={[
        `Log a verbal instruction or SI the moment it's given, even before formal cost agreement exists — so there's a timestamped record either way`,
        `Photograph the scaffold at handover, so "what existed when it was signed off" is never just a memory`,
        `Photograph damaged, lost, or extended equipment as evidence`,
        `Record additional labour and hire time via Day Works Sheets`,
        `Keep every email and site conversation in one Correspondence trail`
      ]}
      workflow={`Instruction or request given on site → logged as an Update the same day → tagged to the relevant Site Instruction or Variation → photos and Day Works attached as the work happens → bundled into a Variation Package before the claim goes in, not after it's disputed.`}
      whyItMatters={`A missed hire extension or an unclaimed extra lift doesn't feel like much on its own. Across a year of jobs, it's real, recoverable money you're quietly writing off.`}
    />
  );
}
