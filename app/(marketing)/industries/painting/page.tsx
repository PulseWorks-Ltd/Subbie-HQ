import type { Metadata } from "next";
import { IndustryPageView } from "@/components/marketing/industry-page-view";

export const metadata: Metadata = {
  title: "Contract & Commercial Management for Painting Contractors | Subbie HQ",
  description: "Subbie HQ helps painting subcontractors track spec changes, extra coats, and rework caused by other trades."
};

export default function PaintingPage() {
  return (
    <IndustryPageView
      h1={`"Can You Give That Another Coat?"`}
      heroHook={`A five-second question on site can quietly become hours of unpaid work.`}
      reality={`The colour schedule changes after you've already painted three rooms. Extra prep work somehow becomes "part of the original quote." Another trade damages a wall you finished last week, and you're expected to repaint it for free. The architect upgrades the paint system after you priced the job, and nobody mentions it until you've already started. Every painter recognises at least one of these.`}
      lossScenarios={[
        `Additional coats instructed verbally, with no note of who asked or when`,
        `Substrate preparation beyond what was quoted, absorbed into the original price`,
        `Colour or specification changes made after work has already started`,
        `Rework caused by another trade's damage, with no photo record of the original finished work`,
        `Material upgrades (a better paint system, a different finish) priced after the job was already quoted`,
        `Access delays caused by other trades, extending time on site`
      ]}
      contractRequirements={`Many painting subcontracts treat a specification change as a variation requiring written instruction and agreed pricing before the changed work proceeds — but what actually counts as "in scope" versus "extra" varies contract to contract, so it's worth knowing your own. What's consistent: a photo of the finished work before another trade gets near it is worth far more after the fact than a memory of how it looked.`}
      howWeHelp={[
        `Photograph completed work before another trade can damage it — and the damage itself, if it happens`,
        `Log a spec or colour change as an Update the moment it's given`,
        `Record extra coats and materials against the job via Day Works`,
        `Keep the full trail of who asked for what, and when`
      ]}
      workflow={`Change instructed on site → logged as an Update → photo evidence attached → extra materials/coats recorded via Day Works → bundled into a Variation Package when it's time to claim.`}
      whyItMatters={`An extra coat here, a redo there — none of it looks like much in the moment. By the end of a job, it's the difference between the margin you quoted and the margin you actually made.`}
    />
  );
}
