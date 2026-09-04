import type { Metadata } from "next";
import { GuideArticleView } from "@/components/marketing/guide-article-view";

export const metadata: Metadata = {
  title: "Payment Claims Under the Construction Contracts Act — A Subcontractor's Guide | Subbie HQ",
  description:
    "A plain-English guide to what a valid payment claim needs under the Construction Contracts Act 2002, what happens if the Main Contractor doesn't respond in time, and how to protect your entitlement to be paid."
};

export default function PaymentClaimsGuidePage() {
  return (
    <GuideArticleView h1="Payment Claims Under the Construction Contracts Act">
      <div className="flex flex-col gap-3">
        <p className="text-on-surface-variant">
          The Construction Contracts Act 2002 (CCA) exists because payment disputes on construction projects used to
          drag on for months, while the subcontractor who&rsquo;d actually done the work carried the cost. The Act
          gives every party the right to make a payment claim, sets strict timeframes for responding to one, and
          means a Main Contractor who stays silent doesn&rsquo;t get to simply not pay. It&rsquo;s one of the few
          pieces of leverage a subcontractor has that doesn&rsquo;t depend on goodwill or relationship.
        </p>
        <p className="text-on-surface-variant">
          Most of that protection only works if the claim itself is valid, submitted on time, and properly evidenced.
          Here&rsquo;s what that actually means.
        </p>
      </div>

      <section>
        <h2 className="text-lg font-bold mb-2">1. What the Act protects</h2>
        <p className="text-on-surface-variant mb-3">
          The CCA gives anyone who&rsquo;s carried out construction work the right to make a payment claim for it,
          whether or not the underlying contract says anything about progress payments at all. Once a valid claim is
          served, the payer has a fixed number of days (the contract's own terms, or the Act's default timeframes
          where the contract is silent) to respond with a payment schedule — a document that says what they intend
          to pay, and if it&rsquo;s less than claimed, why.
        </p>
        <p className="text-on-surface-variant">
          Miss that response deadline, and the payer generally becomes liable for the full claimed amount — not what
          they think the work was worth, what was actually claimed. That's the mechanism that makes a properly made
          claim genuinely powerful.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">2. What makes a claim valid</h2>
        <p className="text-on-surface-variant mb-3">
          A payment claim under the Act needs to identify the construction work and the relevant period, state the
          claimed amount and how it was calculated, and indicate that it&rsquo;s made under the Construction
          Contracts Act. Most subcontracts layer their own requirements on top of that statutory minimum — a
          specific claim format (often mirroring the sample forms in a standard subcontract's appendices), a
          detailed breakdown against the schedule of prices, and clear references for any variations being claimed.
        </p>
        <p className="text-on-surface-variant">
          A claim that&rsquo;s vague about what it's actually for, or that bundles unapproved variations in with
          progress claims without separating them out, is an easy target to dispute — not because the work
          wasn&rsquo;t done, but because the claim itself doesn&rsquo;t clearly establish what&rsquo;s being claimed
          and why.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">3. What happens if the Main Contractor doesn&rsquo;t respond in time</h2>
        <p className="text-on-surface-variant mb-3">
          If a valid payment claim goes unanswered past the response deadline, the payer becomes liable to pay the
          claimed amount in full — they lose the right to dispute the value of the work at that point, at least for
          that claim. This is the CCA's central piece of leverage, and it only exists because the claim itself was
          valid and could be shown to have actually been served on time.
        </p>
        <p className="text-on-surface-variant">
          That's why proving what was claimed, and when, matters as much as the claim's dollar figure — a dispute
          over whether a claim was even received, or received on time, undoes the protection the Act is supposed to
          give you.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">4. Common mistakes</h2>
        <ul className="flex flex-col gap-2 list-disc list-inside text-on-surface-variant mb-3">
          <li>Submitting a claim without a clear breakdown against the original contract works and any variations.</li>
          <li>Claiming a variation that was never formally instructed or notified in writing.</li>
          <li>Missing the claim date entirely, or submitting so close to it that a dispute over timing is possible.</li>
          <li>No record of retention already withheld, so the net amount claimed doesn&rsquo;t reconcile.</li>
          <li>No proof the claim was actually sent, or sent to the right person, on the date claimed.</li>
        </ul>
        <p className="text-on-surface-variant">
          Individually these look like paperwork issues. Together, they're the difference between a claim that
          forces a response and one that just gets argued over indefinitely.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-3">5. How evidence strengthens a claim</h2>
        <p className="text-on-surface-variant mb-3">
          This is the part Subbie HQ is actually built around. A Payment Claim in Subbie HQ isn&rsquo;t typed up from
          scratch each month — it's generated directly from your own live records:
        </p>
        <ul className="flex flex-col gap-2 list-disc list-inside text-on-surface-variant mb-3">
          <li>
            Original contract works progress is calculated straight from your Contract Schedule — every priced item,
            what's been claimed before, and what's genuinely new this period.
          </li>
          <li>
            Approved Variations are allocated to the claim individually, so the claim itself shows exactly which
            Variations are in it and what's still outstanding.
          </li>
          <li>
            Retention is tracked automatically — the percentage withheld, the running total held to date, and the
            two-stage release (an initial release once your works are complete, and a final release, typically at
            the end of the Defects Liability Period) with a clear action to mark each stage complete.
          </li>
          <li>
            The claim itself generates as a PDF matching the standard payment claim schedule structure — every
            numbered line a Main Contractor&rsquo;s QS already expects to see, not a bespoke format they have to
            decode.
          </li>
          <li>
            Sending it creates its own record: pick who it goes to, review an auto-drafted covering email, and the
            claim is emailed with the PDF attached and marked issued — a timestamped, evidenced claim date, not a
            memory of when you meant to send it.
          </li>
        </ul>
        <p className="text-on-surface-variant">
          None of that changes what the Act requires. It just means that when a claim's validity or timing gets
          questioned, the answer is already sitting in your project record instead of something you have to
          reconstruct from memory.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">6. Where to get real legal advice</h2>
        <p className="text-on-surface-variant">
          This guide is general information, not legal advice — the Construction Contracts Act, your specific
          subcontract's terms, and how they interact can genuinely vary between jobs. If you're actually in a
          payment dispute, or unsure whether a specific claim or response is valid, talk to a construction lawyer or
          your industry association before relying on anything here.
        </p>
      </section>
    </GuideArticleView>
  );
}
