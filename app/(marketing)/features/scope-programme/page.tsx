import type { Metadata } from "next";
import { FeaturePageView } from "@/components/marketing/feature-page-view";

export const metadata: Metadata = {
  title: "Scope & Programme Tracking for Subcontractors | Subbie HQ",
  description:
    "Know exactly what your contract scopes you into, and track the programme milestones you're actually held to — pulled straight from your own documents."
};

export default function ScopeProgrammePage() {
  return (
    <FeaturePageView
      h1="Know What You're Scoped Into, and When It's Due"
      problem="Your scope of works is buried in a contract you read once. The programme is a PDF someone emailed you at tender stage. Months into the job, it's genuinely hard to say what you actually signed up for versus what's crept in since — and easy to miss a milestone you're being held to."
      consequence="Work gets done that was never really in scope, absorbed as goodwill. A programme milestone slips past without anyone flagging it, until it's someone else's problem to explain."
      helps={[
        "Upload your subcontract and get your scope of works pulled out as a checklist you can actually refer back to — not a paragraph buried on page 30.",
        "Upload the programme and get its milestones parsed out automatically, with completion tracked against each one. Re-upload a revised programme later and it updates cleanly, without losing what's already been marked done.",
        "On a multi-trade programme, only the milestones relevant to your trade are surfaced — not someone else's schedule cluttering yours."
      ]}
      outcome="A clear, checkable record of what you're scoped to do and when you're due to do it — pulled from your own documents, not from memory."
    />
  );
}
