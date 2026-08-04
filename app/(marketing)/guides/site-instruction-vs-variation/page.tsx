import type { Metadata } from "next";
import { GuideOutlineView } from "@/components/marketing/guide-outline-view";

export const metadata: Metadata = {
  title: "Site Instruction vs Variation: What's the Difference? | Subbie HQ",
  description: "A subcontractor's guide to the difference between a Site Instruction and a Variation, and why it matters for getting paid."
};

export default function SiteInstructionVsVariationGuidePage() {
  return (
    <GuideOutlineView
      h1="Site Instruction vs Variation: What's the Difference?"
      outline={[
        "What an SI is",
        "What turns it into a Variation",
        "Why the distinction matters for payment",
        "What good evidence looks like",
        "A worked example"
      ]}
    />
  );
}
