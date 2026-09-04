import type { Metadata } from "next";
import { IndustryPageView } from "@/components/marketing/industry-page-view";

export const metadata: Metadata = {
  title: "Contract & Commercial Management for Civil Contractors | Subbie HQ",
  description: "Subbie HQ helps civil subcontractors track ground condition variations, extra cartage, and design changes before they become disputed invoices."
};

export default function CivilPage() {
  return (
    <IndustryPageView
      h1={`"The Geotech Report Didn't Show This."`}
      heroHook={`Two metres into an excavation you hit rock, or contaminated fill, or an unmapped service — and now you're arguing about whose problem it is.`}
      reality={`The geotech report said one thing, and the ground says another. You strike rock where the design assumed clay, or unexpected fill that needs to be removed and carted off-site instead of reused, or a service nobody had mapped. The PM tells you to keep digging and sort out the paperwork later — the programme can't stop for it. You do, because stopping the job costs everyone more than finishing the argument first. Weeks later, that extra cartage and the additional plant time it took are disputed as something you should have allowed for in your original price.

It happens with design changes too. Levels or drainage falls get revised after you've already established the site and cut to the original design. Compaction testing fails and you're re-working an area you'd already signed off as complete. Weather shuts the site down for days, and the extended plant hire and standing time that costs never gets claimed because there's no record of exactly which days were lost and why.`}
      lossScenarios={[
        `Unexpected ground conditions (rock, contaminated fill, unmapped services) instructed to proceed on site with no written variation`,
        `Additional cartage and disposal costs absorbed as "part of the original earthworks price"`,
        `Design changes to levels or drainage falls made after the site's already been cut to the original design`,
        `Failed compaction testing requiring re-work on an area already signed off as complete`,
        `Weather or access delays extending plant hire and standing time, with no record of which days were actually lost`,
        `Extra plant or labour brought in to keep the programme moving, never separately claimed`
      ]}
      contractRequirements={`Most civil subcontracts treat a genuine change in ground conditions, or a design revision, as a variation requiring written instruction and agreed pricing before the additional work proceeds — "keep digging, we'll sort it later" doesn't remove that requirement, it just makes it easy to lose the record of what actually happened and when. What actually counts as a latent condition versus something you should have allowed for varies contract to contract, so it's worth knowing your own. What's consistent: a dated photo of the rock face or the fill you struck is worth far more at claim time than a description written from memory weeks later.`}
      howWeHelp={[
        `Log an unexpected ground condition or design change as an Update the moment it's found, with photos of exactly what was struck`,
        `Record additional cartage, plant, and labour via Day Works, tied to the instruction that caused it`,
        `Track weather and access delay days as they happen, not reconstructed from memory at claim time`,
        `Keep every site instruction and email about a design or scope change in one Correspondence trail`,
        `Send a variation for approval with a secure link the PM can act on with no login — a written approval that actually exists, not a verbal "keep going" on site`
      ]}
      workflow={`Ground condition or design change found on site → logged as an Update with photos the same day → tagged to the relevant Site Instruction or Variation → additional plant/cartage recorded via Day Works → bundled into a Variation Package before the claim goes in, not after it's disputed.`}
      whyItMatters={`An extra day of cartage here, a failed compaction re-test there — none of it looks like much in the moment. Across a job, it's the difference between the margin you priced and the margin you actually made.`}
    />
  );
}
