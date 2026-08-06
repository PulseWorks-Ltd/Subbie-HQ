import type { Metadata } from "next";
import { IndustryPageView } from "@/components/marketing/industry-page-view";

export const metadata: Metadata = {
  title: "Contract & Commercial Management for Masonry Contractors | Subbie HQ",
  description: "Subbie HQ helps masonry and blocklaying subcontractors track ground-condition variations, engineering changes, and weather delays."
};

export default function MasonryPage() {
  return (
    <IndustryPageView
      h1="Built for the Way Masonry Contractors Actually Work"
      intro="A masonry quote is priced against a set of drawings and assumed ground conditions — and both routinely change once footings are opened up. Reinforcing gets revised by the engineer, ground turns out softer or rockier than expected, and a retaining wall's design gets adjusted for compliance reasons that have nothing to do with your workmanship. None of that is unusual for the trade — but if it isn't captured in writing when it happens, it's very hard to claim for later. Add in that masonry is genuinely weather-dependent (laying and curing both stop in the wrong conditions), and a job that looked straightforward on the quote can quietly become a lot of unpaid extra work."
      risksHeading="Common risks Subbie HQ helps you watch for:"
      risks={[
        "Contracts that shift responsibility for unexpected ground conditions at footings (rock, soft fill, unsuitable material) onto the subcontractor",
        "Engineer-directed reinforcing, starter bar, or foundation design changes with no corresponding cost adjustment",
        "Retaining wall compliance changes (structural sign-off, surcharge/boundary conditions) altering scope after work has started",
        "Weather-dependent laying and curing delays with no extension of time protection in the contract"
      ]}
    />
  );
}
