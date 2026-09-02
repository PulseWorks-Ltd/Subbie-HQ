import type { Metadata } from "next";
import { GuideArticleView } from "@/components/marketing/guide-article-view";

export const metadata: Metadata = {
  title: "Site Instruction vs Variation – Why the Difference Matters | Subbie HQ",
  description:
    "How SA-2017 draws the line between a site instruction and a claimable variation, the notification deadlines that protect your entitlement, and where subcontractors commonly lose money."
};

export default function SiteInstructionVsVariationGuidePage() {
  return (
    <GuideArticleView h1="Site Instruction vs Variation – Why the Difference Matters">
      <div className="flex flex-col gap-3">
        <p className="text-on-surface-variant">
          On most construction sites, instructions come in many forms: verbal directions, emails, marked-up
          drawings, site meeting notes, or formal written site instructions. Not every instruction is automatically
          a variation that you can claim extra money for.
        </p>
        <p className="text-on-surface-variant">
          Under the standard SA-2017 Subcontract Agreement (Section 9), the distinction is important and the process
          is clear.
        </p>
      </div>

      <section>
        <h2 className="text-lg font-bold mb-2">What is a Site Instruction?</h2>
        <p className="text-on-surface-variant">
          A site instruction is simply a direction from the main contractor about how the work should be carried
          out. It might confirm something already in the contract, clarify a detail, or change the sequence of
          work. On its own, a site instruction does not automatically mean you will be paid extra.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">What turns work into a Variation?</h2>
        <p className="text-on-surface-variant mb-2">
          A variation is a change to the original scope, quantity, quality, or method of the subcontract works.
          Under SA-2017:
        </p>
        <ul className="flex flex-col gap-2 list-disc list-inside text-on-surface-variant mb-3">
          <li>The main contractor can issue a written instruction to vary the works (clause 9.1.1).</li>
          <li>
            If you receive an instruction and believe it involves a variation, you must notify the main contractor
            in writing within the time stated in the Specific Conditions (commonly 5 Working Days – clause 9.1.3).
          </li>
          <li>You must then submit a price and supporting details within the required timeframe (clause 9.2.2).</li>
        </ul>
        <p className="text-on-surface-variant">
          If you do not notify within the required period, the work may not be treated as a variation at all.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-3">The practical sequence that protects you</h2>
        <ol className="flex flex-col gap-2 list-decimal list-inside text-on-surface-variant">
          <li>Receive a written instruction (or immediately confirm a verbal one in writing).</li>
          <li>Decide whether the instruction changes the original scope or cost.</li>
          <li>Notify the main contractor in writing that you consider it a variation and that additional costs will apply.</li>
          <li>Submit a properly substantiated variation claim with the additional costs, labour, materials, and any other supporting evidence.</li>
          <li>Only include approved variations in your monthly payment claim.</li>
        </ol>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-3">Where subcontractors commonly lose money</h2>
        <ul className="flex flex-col gap-2 list-disc list-inside text-on-surface-variant">
          <li>Treating every site instruction as automatically payable extra work.</li>
          <li>Doing the work first and trying to claim it later without proper notification.</li>
          <li>Missing the notification deadline.</li>
          <li>Submitting a variation claim with weak or missing supporting information.</li>
          <li>Bundling unapproved variations into the progress claim and having them scheduled at nil.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">Why this matters for cash flow</h2>
        <p className="text-on-surface-variant mb-3">
          When variations are not properly notified and substantiated, they are frequently declined or deferred.
          That money either arrives late or never arrives at all. Over a project, the cumulative effect can be
          significant.
        </p>
        <p className="text-on-surface-variant mb-3">
          The subcontractors who protect their margin treat every instruction as a potential commercial event. They
          record it, assess it, notify it, and evidence it while the work is still fresh — instead of trying to
          reconstruct it weeks later at claim time.
        </p>
        <p className="font-bold text-on-surface">
          That disciplined approach is exactly what Subbie HQ is designed to support.
        </p>
      </section>
    </GuideArticleView>
  );
}
