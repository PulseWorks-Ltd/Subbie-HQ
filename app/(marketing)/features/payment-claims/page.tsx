import type { Metadata } from "next";
import { FeaturePageView } from "@/components/marketing/feature-page-view";

export const metadata: Metadata = {
  title: "Payment Claims Built From Your Own Records | Subbie HQ",
  description:
    "Generate a Payment Claim straight from your Contract Schedule and Variations, with retention tracked automatically and a real PDF ready to send — not a spreadsheet rebuilt from memory every month."
};

export default function PaymentClaimsPage() {
  return (
    <FeaturePageView
      h1="A Payment Claim Built From Your Own Records"
      dek="Generated from your Contract Schedule and Variations — not retyped from memory every month."
      problem="Every month, the same claim gets rebuilt almost from scratch: work out what's been claimed before, what's new this period, which variations are actually approved and how much of each has already gone through, and what retention's been withheld along the way. Get any one of those numbers wrong and the whole claim is easier to dispute."
      consequence="Claims go in late, or with figures that don't quite reconcile with the last one, because nobody has time to rebuild a clean commercial picture from a folder of quotes, emails, and last month's spreadsheet every single time. A rejected or disputed claim doesn't just cost the argument — it costs a whole payment cycle."
      helps={[
        "Your original contract works progress comes straight from the Contract Schedule — every priced item, what's already been claimed, and what's genuinely new this period, calculated the same way every time.",
        "Approved Variations are allocated to the claim individually. You can see exactly which Variations are in this claim, and what's still outstanding on the ones that aren't.",
        "Retention is tracked automatically — the percentage withheld, the running total held to date, and the two-stage release most subcontracts use (an initial release once your own works are complete, then a final release later, typically at the end of the Defects Liability Period) — with a clear action to mark each stage complete when it actually happens.",
        "The claim itself generates as a real PDF, laid out against the standard numbered payment claim schedule structure a Main Contractor's QS already expects — not a bespoke format they have to work out from scratch.",
        "Sending it is part of the same flow: pick who it goes to (with CC for a QS or contract administrator), review an auto-drafted covering email, and it goes out with the PDF attached — the claim is marked issued, with a real sent date, not a guess at when it went out."
      ]}
      outcome="A Payment Claim that reconciles with the last one, shows its own working, and goes out the same day it's ready — built from what's actually in your project, not rebuilt from memory."
    />
  );
}
