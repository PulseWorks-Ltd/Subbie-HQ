import type { Metadata } from "next";
import { IndustryPageView } from "@/components/marketing/industry-page-view";

export const metadata: Metadata = {
  title: "Contract & Commercial Management for Scaffolding Contractors | Subbie HQ",
  description: "Subbie HQ helps scaffolding subcontractors track access instructions, dayworks, and variations for extra scope."
};

export default function ScaffoldingPage() {
  return (
    <IndustryPageView
      h1="Built for the Way Scaffolding Contractors Actually Work"
      intro="Scaffold scope changes constantly — extra lifts, extended hire periods, access changes nobody put in writing. Subbie HQ captures the instruction the moment it's given, tracks every day the scaffold stays up longer than quoted, and turns extended hire or additional scope into a properly evidenced variation instead of a conversation nobody remembers the same way."
      risksHeading="Common scaffolding-specific risks Subbie HQ helps you watch for:"
      risks={[
        "Contracts that delete standard scaffold-provision clauses, shifting supply cost onto you",
        "Hire period extensions that were never formally instructed",
        "Access/hoisting obligations added without a corresponding cost allowance"
      ]}
    />
  );
}
