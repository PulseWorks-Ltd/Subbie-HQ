import type { Metadata } from "next";
import { IndustryPageView } from "@/components/marketing/industry-page-view";

export const metadata: Metadata = {
  title: "Contract & Commercial Management for Residential Builders | Subbie HQ",
  description: "Subbie HQ helps residential building subcontractors track client-requested changes, staged progress claims, and undocumented instructions."
};

export default function ResidentialBuildersPage() {
  return (
    <IndustryPageView
      h1={`"The Client Wants to Change This."`}
      heroHook={`Said once, on site, in passing — and somehow it's your problem to prove three months later.`}
      reality={`You finish a stage, submit your progress claim, and the response comes back: "the stage isn't complete." Or the client's asked for "just a few small changes" throughout the build that were never formally documented. Months later, at final account, you're arguing over thousands of dollars of work because everyone remembers the conversations differently. Residential building moves fast — instructions get given on site, decisions get made in minutes, and the paperwork gets left for later, if it happens at all.`}
      lossScenarios={[
        `Progress claims disputed because a contract stage was interpreted differently than you understood it on site`,
        `Client-requested changes agreed verbally, never documented as a variation`,
        `Provisional sum items and selections finalised without a clear written record of what was actually chosen`,
        `Design or specification changes arriving via a council RFI response, with no clear record of who actually asked for the change`,
        `Scope creep absorbed a little at a time until it adds up to real, unclaimed cost`,
        `Programme impacts from client-driven changes, with no extension of time ever raised`
      ]}
      contractRequirements={`Many residential subcontracts define each payment stage precisely — what "complete" actually means for that stage — and require a formal instruction before a client-requested change is priced and carried out. What counts as "complete," and how a variation needs to be raised, is worth checking against your own contract rather than assumed. What's consistent: a stage argued over at claim time is far easier to defend with continuous photos and records than with memory alone.`}
      howWeHelp={[
        `Log client-requested changes as an Update the moment they're raised`,
        `Photograph each stage as it's completed, before the next one starts`,
        `Record selections, provisional sum decisions, and instructions in writing as they happen`,
        `Keep a full correspondence trail linking every change back to who requested it`,
        `Get a client-requested change or a completed stage signed off with a secure link they can act on with no login — a real record, not "they said it was fine"`
      ]}
      workflow={`Change or instruction given → logged as an Update with photos → tagged to a Site Instruction or Variation → Day Works and materials recorded → bundled into a Variation Package to support your claim or final account.`}
      whyItMatters={`A dispute over "was the stage actually complete" or "who asked for this change" is won or lost on the evidence you have on the day — not on what anyone remembers three months later.`}
    />
  );
}
