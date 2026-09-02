import type { Metadata } from "next";
import { GuideArticleView } from "@/components/marketing/guide-article-view";

export const metadata: Metadata = {
  title: "Why Late or Non-Compliant Claims Cost Subcontractors Money | Subbie HQ",
  description:
    "How SA-2017 and the Construction Contracts Act 2002 govern payment and variation claim deadlines, why non-compliant claims get returned, and what it costs when they do."
};

export default function LateOrNonCompliantClaimsGuidePage() {
  return (
    <GuideArticleView h1="Why Late or Non-Compliant Claims Cost Subcontractors Money">
      <div className="flex flex-col gap-3">
        <p className="text-on-surface-variant">
          A payment claim that misses its deadline by a single day, or a variation submitted in the wrong format,
          doesn&rsquo;t just create paperwork. It can push real money out of this month&rsquo;s payment run and
          into next month&rsquo;s — or out of the job entirely. For a subcontractor running on tight cash flow,
          that&rsquo;s not a technicality. That&rsquo;s income you&rsquo;ve already earned, sitting somewhere you
          can&rsquo;t touch it.
        </p>
        <p className="text-on-surface-variant">
          Most subcontractors operate under contracts based on the standard SA-2017 Subcontract Agreement (and the
          Construction Contracts Act 2002). These documents set clear, strict rules around when and how payment
          claims and variation claims must be submitted — and the rules aren&rsquo;t forgiving of a day&rsquo;s
          delay or a missing detail.
        </p>
        <p className="text-on-surface-variant">
          Here&rsquo;s what those rules actually require, and what it costs when they&rsquo;re not followed.
        </p>
      </div>

      <section>
        <h2 className="text-lg font-bold mb-2">1. Strict deadlines exist for a reason</h2>
        <p className="text-on-surface-variant mb-3">
          Under SA-2017 Specific Conditions (clause 12.1.1), payment claims are commonly due a set number of working
          days before the end of the month for work to the end of that month. Variation claims often have an earlier
          deadline.
        </p>
        <p className="text-on-surface-variant">
          If your claim arrives even one day after the due date, it can technically be treated as having been
          received late and only submitted for the next month&rsquo;s claim cycle. That can push your payment back
          an entire month and seriously harm cash flow.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">2. Progress claims and variation claims are not the same thing</h2>
        <p className="text-on-surface-variant mb-3">
          Many contracts require variation claims to be submitted earlier than the main progress claim. Holding
          variations back and trying to include them with the monthly progress claim is one of the most common
          reasons for having your variations declined for payment in that month.
        </p>
        <p className="text-on-surface-variant mb-2">All variations submitted should have:</p>
        <ul className="flex flex-col gap-2 list-disc list-inside text-on-surface-variant mb-3">
          <li>A written instruction requesting the work</li>
          <li>Notification that the work is considered a variation and will incur additional costs</li>
          <li>The variation claim itself with the additional costs and supporting information to substantiate it</li>
        </ul>
        <p className="text-on-surface-variant">
          Only variations that have been properly notified and approved in writing should be included. Claiming
          unapproved or poorly substantiated variations usually results in them being scheduled at nil.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">3. Format and supporting information matter</h2>
        <p className="text-on-surface-variant mb-3">
          A payment claim must comply with the Construction Contracts Act 2002. Most contracts also require the claim
          to follow a specific format (often based on the sample forms in the SA-2017 Appendices) and to include a
          detailed breakdown against the schedule of prices plus clear references for any approved variations.
        </p>
        <p className="text-on-surface-variant">
          Claims that are incomplete, poorly structured, or missing required information are routinely returned as
          non-compliant. You then have to re-work and re-submit them, which costs time and delays cash flow.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">4. Buyer-created invoicing is the norm</h2>
        <p className="text-on-surface-variant">
          Under standard SA-2017 wording (clause 12.1.4), subcontractors must not issue tax invoices for the
          subcontract works. The main contractor issues a buyer-created tax invoice with each payment. Sending your
          own invoice alongside the claim creates unnecessary reconciliation problems for both parties.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">5. Off-site materials have their own rules</h2>
        <p className="text-on-surface-variant">
          If the contract allows payment for materials stored off-site, there are almost always earlier notice and
          inspection requirements. Missing the notice window usually means those materials cannot be claimed that
          month.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-3">The real cost of getting it wrong</h2>
        <ul className="flex flex-col gap-2 list-disc list-inside text-on-surface-variant mb-4">
          <li>A non-compliant claim is returned → more administration and delay.</li>
          <li>A late claim can roll into the next month → cash-flow hit.</li>
          <li>
            Missing variation deadlines or failing to properly notify and substantiate variations can mean the work
            is never paid as a variation.
          </li>
          <li>Repeated issues make future claims harder and damage the working relationship.</li>
        </ul>
        <p className="text-on-surface-variant mb-3">
          These rules exist because main contractors are under pressure from their own head contracts and quantity
          surveyors. The subcontractors who get paid more reliably treat claim requirements as a system problem, not
          a paperwork problem. They keep site instructions, dayworks, photos, and correspondence organised against
          each job from day one, so that when the claim deadline arrives the evidence is already in one place and
          the claim can be assembled cleanly and on time.
        </p>
        <p className="font-bold text-on-surface">
          That is exactly the problem Subbie HQ was built to solve.
        </p>
      </section>
    </GuideArticleView>
  );
}
