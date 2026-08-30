import type { Metadata } from "next";
import { FeaturePageView } from "@/components/marketing/feature-page-view";

export const metadata: Metadata = {
  title: "Quality Assurance & Health and Safety Records for Subcontractors | Subbie HQ",
  description:
    "Keep SSSPs, hazard registers, toolbox talks, inductions and QA sign-offs organised against the job, not scattered across whoever happened to take the photo."
};

export default function QualityAssurancePage() {
  return (
    <FeaturePageView
      h1="Your QA and H&S Records, Actually Findable"
      problem="A SSSP here, a toolbox talk there, a QA photo texted to whoever asked for it. It all technically exists — somewhere — which is a different thing from being able to produce it the moment a Main Contractor or an inspector actually asks."
      consequence="When someone asks for proof — a hazard register, an induction record, a QA sign-off on a specific stage — the honest answer is often 'let me find it,' not 'here it is.'"
      helps={[
        "Log QA records and categorise H&S documents (SSSPs, hazard registers, toolbox talks, inductions, incident reports) against the project they belong to, the moment they happen — not reconstructed later from memory.",
        "Already got a photo logged as a site Update? Turn it into a QA Record directly, without re-uploading or re-typing anything — the evidence you already captured just gets used twice.",
        "Everything sits in one place per project, organised by category, ready to hand over the moment it's asked for."
      ]}
      outcome="A QA and H&S record for every job that's actually there when it's needed — not a promise that it exists somewhere."
    />
  );
}
