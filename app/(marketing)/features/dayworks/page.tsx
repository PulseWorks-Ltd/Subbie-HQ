import type { Metadata } from "next";
import { FeaturePageView } from "@/components/marketing/feature-page-view";

export const metadata: Metadata = {
  title: "Dayworks Recording for Subcontractors | Subbie HQ",
  description: "Photograph the dayworks sheet and let Subbie HQ read the crew, hours, and cost — no re-typing timesheets."
};

export default function DayworksPage() {
  return (
    <FeaturePageView
      h1="Never Lose Labour Costs Again"
      problem="Dayworks sheets get filled in on paper, on site, in a hurry — and then somebody has to re-type them into a spreadsheet at the end of the week, if they get typed up at all."
      consequence="Sheets get lost. Hours get forgotten. Labour cost on a variation ends up being a rough guess instead of a real number."
      helps={[
        "Photograph the sheet. Subbie HQ reads the sheet number, crew size, and hours — you confirm it's right and add your rate. It's added straight to the job it belongs to, ready to feed into your next Variation claim."
      ]}
      outcome="A real, defensible labour cost for every variation — captured on the day, not reconstructed from memory weeks later."
    />
  );
}
