import type { Metadata } from "next";
import { FeaturePageView } from "@/components/marketing/feature-page-view";

export const metadata: Metadata = {
  title: "Dayworks Recording for Subcontractors | Subbie HQ",
  description:
    "Photograph the dayworks sheet and let Subbie HQ read the crew, hours, and cost — then get it approved via a secure link, no app and no login required."
};

export default function DayworksPage() {
  return (
    <FeaturePageView
      h1="Never Lose Labour Costs Again"
      dek="Site Managers approve the sheet via a secure link — no app, no login required."
      problem="Dayworks sheets get filled in on paper, on site, in a hurry — and then somebody has to re-type them into a spreadsheet at the end of the week, if they get typed up at all. Getting the Site Manager's signature on the day is the exception, not the rule."
      consequence="An unsigned sheet sitting in a folder for a week is money you can no longer properly prove. Hours get forgotten, crew details get fuzzy, and the labour cost on a variation ends up being a rough guess instead of a real, defensible number — reduced or declined when the claim finally goes in."
      helps={[
        "Photograph the sheet. Subbie HQ reads the sheet number, crew size, and hours — you confirm it's right and add your rate. It's added straight to the job it belongs to, ready to feed into your next Variation claim.",
        "When the Site Manager isn't around to sign it on the spot, send it for approval with a secure link instead of chasing them down later — no app to install, no account to create. They open it, review the hours and crew, and approve it directly, the same day it was worked. Once approved, it's marked complete, properly linked to the Site Instruction, and ready to support the variation claim."
      ]}
      outcome="A real, defensible labour cost for every variation — captured and signed off on the day, not reconstructed from memory weeks later."
    />
  );
}
