import type { Metadata } from "next";
import { IndustryPageView } from "@/components/marketing/industry-page-view";

export const metadata: Metadata = {
  title: "Contract & Commercial Management for Residential Builders | Subbie HQ",
  description: "Subbie HQ helps residential building subcontractors track staged progress claims, site-instructed changes, and variations on multi-unit and developer-led builds."
};

export default function ResidentialBuildersPage() {
  return (
    <IndustryPageView
      h1="Built for the Way Residential Builders Actually Work"
      intro={
        'When you\'re engaged as a subcontractor on a development or multi-unit build — building out one or more dwellings under a head contractor or developer — the commercial risk looks different from a standalone home build. Progress claims need to line up exactly with how the contract defines each stage, not just how the work actually happened on site. Council RFIs and client-requested finishing changes get relayed verbally on site more often than they get issued in writing. And when a dispute happens, it usually comes down to one question: was a stage actually "complete" under the contract\'s own definition, or just complete enough to move on to the next one.'
      }
      risksHeading="Common risks Subbie HQ helps you watch for:"
      risks={[
        'Progress claim stage definitions (e.g. "lock-up," "fixing," "practical completion") that don\'t match how the work was actually staged and recorded on site',
        "Client- or developer-requested variations agreed verbally, with no formal instruction ever issued",
        "Retention and defects liability terms that differ from the standard form, easy to miss in a longer contract",
        "Design or specification changes arriving via council RFI response rather than a direct instruction, with no clear paper trail back to who actually asked for the change"
      ]}
    />
  );
}
