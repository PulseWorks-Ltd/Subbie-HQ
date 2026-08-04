import type { Metadata } from "next";
import { FeaturePageView } from "@/components/marketing/feature-page-view";

export const metadata: Metadata = {
  title: "Understand Your Subcontract Before You Sign | Subbie HQ",
  description: "Upload your subcontract and get a plain-English breakdown of what's changed from standard terms, ranked by what actually matters."
};

export default function ContractReviewPage() {
  return (
    <FeaturePageView
      h1="Know Exactly What You're Signing Before You Sign It"
      problem={
        "Most subcontract “reviews” are a lawyer's invoice you can't afford, or a gut feeling you hope is right. Somewhere in a 60-page document is a clause about notice periods, retention, or set-off rights that could cost you real money if you miss it."
      }
      consequence="Missed notice deadlines mean lost entitlement. Unfamiliar payment preconditions mean delayed cash flow. And nobody finds out until it's already too late to do anything about it."
      helps={[
        "Upload your subcontract. Get a plain-English breakdown of what's genuinely different from standard terms — ranked by what actually matters commercially, not just how many clauses changed. Every finding tells you what to do about it: what to photograph, what to log, what deadline to watch, so you're protected even on a contract you can't renegotiate.",
        "You'll also see what's working in your favour — an honest picture, not a wall of red flags."
      ]}
      outcome="You start the job knowing exactly what's expected of you, and exactly what to keep an eye on — the same starting point an experienced Contracts Manager would give you."
      disclaimer="This is an automated analysis of possible contract differences. It is not legal advice. For a significant commercial decision, get formal legal review."
    />
  );
}
