import type { Metadata } from "next";
import { FeaturePageView } from "@/components/marketing/feature-page-view";

export const metadata: Metadata = {
  title: "Insurance Compliance for Subcontractors | Subbie HQ",
  description:
    "Keep every insurance certificate — Public Liability, Contract Works, Professional Indemnity and more — tracked, distributed, and never quietly expired."
};

export default function InsurancePage() {
  return (
    <FeaturePageView
      h1="Never Let a Certificate Quietly Lapse"
      problem="Every Main Contractor wants proof your insurance is current, usually right when you're already busy with something else. Certificates live in an email somewhere, a folder somewhere else, and nobody's entirely sure which one is the latest."
      consequence="A lapsed certificate isn't just paperwork — some contracts won't let you keep working, or claiming, without current cover on file. Finding out at the wrong moment costs you time you don't have."
      helps={[
        "Store every certificate — Public Liability, Contract Works, Professional Indemnity, Vehicle, and anything else you carry — against your business, once, instead of per project. Distribute the right certificate to the right Main Contractor when a job needs it.",
        "Get warned six weeks out from expiry, and again if one actually lapses, by email and push notification — the same staged reminder approach that already watches your Variation and Site Instruction deadlines."
      ]}
      outcome="Your cover stays current, on file, and provable — without a renewal date ever catching you out."
    />
  );
}
