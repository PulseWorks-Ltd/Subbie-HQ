import type { Metadata } from "next";
import { IndustryPageView } from "@/components/marketing/industry-page-view";

export const metadata: Metadata = {
  title: "Contract & Commercial Management for Masonry Contractors | Subbie HQ",
  description: "Subbie HQ helps masonry and blocklaying subcontractors track ground-condition variations, engineering changes, and weather delays."
};

export default function MasonryPage() {
  return (
    <IndustryPageView
      h1={`"The Ground Wasn't What We Expected."`}
      heroHook={`A quote priced against a drawing rarely survives first contact with real ground.`}
      reality={`Footings go in and the ground turns out softer, rockier, or just different from what was assumed at quoting stage. The engineer revises the reinforcing. A retaining wall's design gets adjusted for a compliance reason that has nothing to do with your workmanship. None of that is unusual for the trade — but if it isn't written down when it happens, it's very hard to claim for once the job's finished and everyone's moved on to the next site.`}
      lossScenarios={[
        `Unexpected ground conditions at footings (rock, soft fill, unsuitable material) absorbed as part of the original price`,
        `Engineer-directed reinforcing or foundation changes with no corresponding cost adjustment`,
        `Additional concrete or blockwork instructed on site, never formally varied`,
        `Retaining wall redesigns for compliance reasons, changing scope after work has started`,
        `Weather-dependent laying and curing delays with no extension of time claimed`,
        `Delayed inspections or access issues extending time on site at your cost`
      ]}
      contractRequirements={`Many masonry subcontracts require a formal instruction before ground-condition or design changes are priced and carried out, and a documented extension of time claim for weather-dependent delays rather than just absorbing the lost days. What exactly counts as a "differing condition" under your contract is worth checking directly, since this varies. What's consistent: the moment ground conditions turn out different from the drawings is the moment to start documenting, not after the wall's built.`}
      howWeHelp={[
        `Log ground condition and design changes as an Update, with photos, the moment they're found`,
        `Record additional concrete, blockwork, and labour via Day Works Sheets`,
        `Track weather-affected days against the job as they happen`,
        `Keep engineer correspondence and revised drawings in one place`,
        `Get a ground-condition or design change formally approved with a secure link the engineer or PM can act on with no login, before the wall's already built`
      ]}
      workflow={`Condition or design change found → logged as an Update with photos → tagged to a Site Instruction or Variation → Day Works and materials recorded → bundled into a Variation Package when it's time to claim.`}
      whyItMatters={`Ground conditions and engineering changes are often the single largest source of unclaimed cost on a masonry job — and they're also the easiest to prove, if you document them the day they happen instead of trying to reconstruct them weeks later.`}
    />
  );
}
