import type { Metadata } from "next";
import { FeaturePageView } from "@/components/marketing/feature-page-view";

export const metadata: Metadata = {
  title: "Project Diary — Site Records & Client Updates for Subcontractors | Subbie HQ",
  description:
    "Photograph the site, talk instead of type, and turn a voice note into a professionally written client email with photos attached — a timestamped daily record without the evening admin."
};

export default function ProjectDiaryPage() {
  return (
    <FeaturePageView
      h1="Turn a Voice Note Into a Professional Client Update"
      problem="Keeping clients and Main Contractors updated is one of the first things that slips when a job gets busy. Writing a proper daily record, or a professional-sounding progress email, takes time nobody has left at the end of a long day on site."
      consequence="So it doesn't get done — or it gets done badly, from memory, days later. No contemporaneous record of what happened, when. A client left wondering what's going on. And a habit that starts strong on day one of the job and quietly stops by week three."
      helps={[
        "Photograph the site. Hit record and just talk — what happened, what's done, what's outstanding. It's transcribed automatically into a timestamped Project Diary entry against the job, no typing required.",
        "When it's worth sharing, hit Draft Email with AI and that same voice note becomes a properly written, professional email — photos attached — ready to send to the Main Contractor, a client, or just to yourself as a dated record you can point back to later. Review it, edit anything you'd say differently, then send.",
        "The photo, the voice note, and the email are the same piece of work, done once — not a site record AND a separate client update written up twice."
      ]}
      outcome="A real daily site record and a professional client update, in the time it takes to talk for thirty seconds — not the twenty minutes it used to cost you every evening."
    />
  );
}
