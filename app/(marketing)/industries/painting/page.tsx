import type { Metadata } from "next";
import { IndustryPageView } from "@/components/marketing/industry-page-view";

export const metadata: Metadata = {
  title: "Contract & Commercial Management for Painting Contractors | Subbie HQ",
  description: "Subbie HQ helps painting subcontractors track variations, coating changes, and materials cost."
};

export default function PaintingPage() {
  return (
    <IndustryPageView
      h1="Built for the Way Painting Contractors Actually Work"
      intro="A coating spec change, an extra coat instructed on site, additional prep work on a surface that wasn't supposed to need it — small changes that add up, and are easy to lose track of across a busy job. Subbie HQ logs the instruction and the extra materials as they happen, so a five-minute site conversation doesn't quietly become unpaid work."
      risksHeading="Common risks Subbie HQ helps you watch for:"
      risks={[
        "Materials markup and cost recovery on instructed spec changes",
        "Extra coats or surface prep instructed verbally, with no written record",
        "Warranty-related obligations tied to specific coating systems"
      ]}
    />
  );
}
