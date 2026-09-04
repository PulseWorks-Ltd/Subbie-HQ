import type { Metadata } from "next";
import { IndustryPageView } from "@/components/marketing/industry-page-view";

export const metadata: Metadata = {
  title: "Contract & Commercial Management for Electrical Contractors | Subbie HQ",
  description: "Subbie HQ helps electrical subcontractors track additional points, switchboard changes, and re-work caused by other trades before they become disputed invoices."
};

export default function ElectricalPage() {
  return (
    <IndustryPageView
      h1={`"Can You Just Add a Point There?"`}
      heroHook={`One extra data point on site today. By practical completion, you can't remember which twenty you actually agreed to.`}
      reality={`The PM walks the floor with you before the ceiling goes in and points out three extra power points and a data outlet "while you're here." You do it — it's a five-minute job on site, a much bigger one to argue about later. Then the switchboard spec changes after you've already priced and ordered gear, because the mechanical load turned out higher than the drawings showed. You absorb the reselection because the job needs to keep moving. At final claim, half of what you did on the walk-through isn't in anyone's notes but yours, and the PM genuinely doesn't remember agreeing to all of it.

It happens with testing and certification too. You complete testing, everything passes, you hand over the certificate — then three weeks later you're back on site because a fitout trade has cut into a cable run you already tested and signed off, and now you're doing rework and re-testing you never priced, with no record of what the wall looked like before someone else cut into it.`}
      lossScenarios={[
        `Extra points, circuits, or outlets instructed verbally during a walk-through, with no written note of what was actually agreed`,
        `Switchboard or distribution board changes made after ordering, absorbed as part of the original scope`,
        `Cable runs or containment damaged by another trade after testing and hand-over, with no photo record of the original completed work`,
        `Data/comms points added late in the programme, treated as "always part of the job" rather than a genuine variation`,
        `Re-testing and re-certification work that's never separately claimed`,
        `Access delays waiting on other trades before first or second fix can proceed`
      ]}
      contractRequirements={`Most electrical subcontracts treat an additional point, circuit, or switchboard change as a variation requiring written instruction and agreed pricing before it proceeds — a verbal "add one there" on a walk-through doesn't remove that requirement, it just makes it easier to forget. What actually counts as in-scope versus extra varies contract to contract, so it's worth knowing your own. What's consistent: a tested-and-signed-off cable run photographed before hand-over is far easier to claim rework against than a memory of what was there before another trade cut into it.`}
      howWeHelp={[
        `Log every point, circuit, or switchboard change from a walk-through as an Update the same day, before it's forgotten`,
        `Photograph completed and tested work before hand-over, so damage by another trade afterward is provable`,
        `Record additional first/second fix labour and materials via Day Works, tied to the instruction that caused it`,
        `Keep every site conversation and email about a scope or spec change in one Correspondence trail`,
        `Send a variation or switchboard change for approval with a secure link the PM can act on with no login — a written approval that actually exists, not a nod on site`
      ]}
      workflow={`Point, circuit, or spec change instructed on site → logged as an Update the same day → tagged to the relevant Site Instruction or Variation → photos and Day Works attached as the work happens → bundled into a Variation Package before the claim goes in, not after it's disputed.`}
      whyItMatters={`Three extra points from a walk-through and a switchboard reselection don't feel like much on their own. Across a year of jobs, they're real, recoverable margin you're quietly giving away.`}
    />
  );
}
