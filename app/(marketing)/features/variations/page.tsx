import type { Metadata } from "next";
import { FeaturePageView } from "@/components/marketing/feature-page-view";

export const metadata: Metadata = {
  title: "Site Instruction & Variation Management for Subcontractors | Subbie HQ",
  description: "Turn a Site Instruction into a fully-evidenced variation claim, ready to send to the Main Contractor."
};

export default function VariationsPage() {
  return (
    <FeaturePageView
      h1="Never Lose Track of a Site Instruction Again"
      problem="Extra work gets instructed verbally on site more often than it gets instructed in writing. An instruction with no paper trail is very hard to get paid for."
      consequence="Work gets done, nobody wrote it down properly, and three months later nobody can prove it happened — least of all when it comes to submitting a claim."
      helps={[
        "Forward the instruction email the moment it lands on your phone. Log a verbal instruction as an Update, on site, in seconds. Either way it's recorded and timestamped before the work even starts. As you do the work, tag photos, dayworks, and correspondence to the same instruction — so by the time it's finished, the evidence already exists."
      ]}
      outcome="When it's time to claim, one button — Generate Variation Package — bundles the instruction, the dayworks, the materials, the photos, and the correspondence into a single document ready to hand to the Main Contractor."
    />
  );
}
