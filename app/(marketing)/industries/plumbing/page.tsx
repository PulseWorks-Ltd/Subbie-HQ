import type { Metadata } from "next";
import { IndustryPageView } from "@/components/marketing/industry-page-view";

export const metadata: Metadata = {
  title: "Contract & Commercial Management for Plumbing Contractors | Subbie HQ",
  description: "Subbie HQ helps plumbing subcontractors track fixture changes, pipe re-routes, and re-work caused by other trades before they become disputed invoices."
};

export default function PlumbingPage() {
  return (
    <IndustryPageView
      h1={`"Just Move It Over a Bit."`}
      heroHook={`A structural clash moves your pipework twenty minutes into a rough-in. Nobody wrote it down, and nobody remembers whose idea it was.`}
      reality={`You get on site to rough-in and a structural beam is sitting exactly where the drawings said your stack would go. The site foreman tells you to just route around it — it's a five-minute conversation, and the job needs to keep moving, so you do it. Three months later, at final claim, that re-route is disputed as "part of the original design" because there's no written instruction anywhere that it ever happened.

It happens with fixtures too. The client upgrades from a standard mixer to a feature tapware package after you've already roughed in for the original spec. You adjust on site because pulling the job up over it isn't practical. Or a hot water system gets upsized after pricing, once the mechanical engineer works out the original unit won't cover the actual load — another absorbed cost nobody formally instructed. And when another trade cuts into pipework you've already pressure-tested and signed off, you're doing rework and re-testing with no record of what was there before they got to it.`}
      lossScenarios={[
        `Pipe routing changed on site to work around a structural clash, with no written instruction that it happened`,
        `Fixture or tapware upgrades made after rough-in has already started, absorbed into the original price`,
        `Hot water system or cylinder upsized after pricing, once actual load is confirmed`,
        `Pressure-tested and signed-off pipework damaged by another trade, with no photo record of the original completed work`,
        `Gas or backflow certification and re-testing work that's never separately claimed`,
        `Access delays waiting on framing or other trades before rough-in or fix-off can proceed`
      ]}
      contractRequirements={`Most plumbing subcontracts treat a re-route, fixture change, or system upsizing as a variation requiring written instruction and agreed pricing before it proceeds — a five-minute conversation on site to solve a clash doesn't remove that requirement, it just makes the paper trail easy to skip. What actually counts as in-scope versus extra varies contract to contract, so it's worth knowing your own. What's consistent: pipework photographed pressure-tested and signed off before it's boxed in is far easier to claim rework against than a memory of what was there before someone else cut into it.`}
      howWeHelp={[
        `Log a re-route, fixture change, or system upsizing as an Update the moment it's agreed on site, not after the job's moved on`,
        `Photograph pressure-tested and signed-off pipework before it's covered or boxed in, so damage by another trade afterward is provable`,
        `Record additional rough-in or fix-off labour and materials via Day Works, tied to the instruction that caused it`,
        `Keep every site conversation and email about a spec or design change in one Correspondence trail`,
        `Send a variation for approval with a secure link the PM can act on with no login — a written approval that actually exists, not a verbal fix agreed on site`
      ]}
      workflow={`Clash or spec change resolved on site → logged as an Update the same day → tagged to the relevant Site Instruction or Variation → photos and Day Works attached as the work happens → bundled into a Variation Package before the claim goes in, not after it's disputed.`}
      whyItMatters={`A twenty-minute re-route around a beam and an absorbed cylinder upsize don't feel like much individually. Across a year of jobs, they're real, recoverable margin you're quietly writing off.`}
    />
  );
}
