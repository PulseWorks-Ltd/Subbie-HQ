import type { Metadata } from "next";
import { GuideOutlineView } from "@/components/marketing/guide-outline-view";

export const metadata: Metadata = {
  title: "Payment Claims Under the Construction Contracts Act — A Subcontractor's Guide",
  description: "A plain-English guide to what a valid payment claim needs, and how to protect your entitlement to be paid on time."
};

export default function PaymentClaimsGuidePage() {
  return (
    <GuideOutlineView
      h1="Payment Claims Under the Construction Contracts Act"
      outline={[
        "What the Act protects",
        "What makes a claim valid",
        "What happens if the Main Contractor doesn't respond in time",
        "Common mistakes",
        "How evidence strengthens a claim (natural link to Subbie HQ)",
        "Where to get real legal advice"
      ]}
    />
  );
}
