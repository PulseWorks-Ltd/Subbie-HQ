import type { Metadata } from "next";
import { GuideArticleView } from "@/components/marketing/guide-article-view";

export const metadata: Metadata = {
  title: "Dayworks – Why Labour Costs Disappear (and How to Stop It) | Subbie HQ",
  description:
    "Why unsigned paper dayworks sheets quietly cost subcontractors their labour claims, what good dayworks evidence actually looks like, and how same-day approval fixes it."
};

export default function DayworksLabourCostsGuidePage() {
  return (
    <GuideArticleView h1="Dayworks – Why Labour Costs Disappear (and How to Stop It)">
      <div className="flex flex-col gap-3">
        <p className="text-[#4c739a] dark:text-slate-400">
          On most sites, dayworks sheets are still filled in on paper. The leading hand or supervisor records the
          crew, the hours, and the work completed, then signs the sheet. The Site Manager is meant to sign it off as
          well.
        </p>
        <p className="text-[#4c739a] dark:text-slate-400">
          In practice, the Site Manager is often unavailable when the crew is ready to leave. The unsigned sheet
          goes in a vehicle or a folder, and is only noticed a week or more later. By then, nobody clearly remembers
          the exact hours, who was there, or precisely what was done. When the variation claim is submitted, the
          dayworks evidence is weak or missing — and the labour cost is reduced or declined.
        </p>
      </div>

      <section>
        <h2 className="text-lg font-bold mb-3">Why this happens so often</h2>
        <ul className="flex flex-col gap-2 list-disc list-inside text-[#4c739a] dark:text-slate-400 mb-3">
          <li>The sheet is completed but never signed by the Site Manager on the day.</li>
          <li>Unsigned sheets are easy to lose or overlook.</li>
          <li>Memory fades quickly once a week or more has passed.</li>
          <li>The link between the labour and the original Site Instruction is weak or missing.</li>
          <li>By the time the claim is prepared, the supporting evidence is incomplete.</li>
        </ul>
        <p className="font-bold text-[#0d141b] dark:text-slate-50">
          The work was done, but it can no longer be properly proven.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">What good dayworks evidence looks like</h2>
        <p className="text-[#4c739a] dark:text-slate-400 mb-2">A solid dayworks record should clearly show:</p>
        <ul className="flex flex-col gap-2 list-disc list-inside text-[#4c739a] dark:text-slate-400">
          <li>The project</li>
          <li>The Site Instruction (or clear description of the work) it relates to</li>
          <li>The workers involved and the hours spent</li>
          <li>Who completed and signed the sheet</li>
          <li>Enough supporting detail that a third party can understand what was done and when</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">How Subbie HQ changes the process</h2>
        <p className="text-[#4c739a] dark:text-slate-400 mb-3">
          With Subbie HQ, dayworks can be recorded clearly, linked to the relevant Site Instruction, and made
          available for signature while everyone still remembers the details.
        </p>
        <ul className="flex flex-col gap-2 list-disc list-inside text-[#4c739a] dark:text-slate-400 mb-3">
          <li>The sheet can be signed on site if the Site Manager is available.</li>
          <li>
            If not, it can be emailed immediately to the Site Manager so it can be reviewed and signed later that
            day or the next.
          </li>
          <li>The email creates a clear timestamped record of when the work was claimed.</li>
          <li>The subcontractor's own QS can be copied in so they know to follow it up.</li>
          <li>The system can track sheets that were not signed on site and were sent for later approval.</li>
          <li>
            Once the Site Manager approves the dayworks (ideally through the existing approval feature), the record
            is marked complete and properly linked to the Site Instruction / variation.
          </li>
        </ul>
        <p className="text-[#4c739a] dark:text-slate-400">
          This removes the most common failure point: the gap between doing the work and having a signed, usable
          record of the labour.
        </p>
      </section>

      <section>
        <p className="text-[#4c739a] dark:text-slate-400 mb-3">
          Subcontractors who treat dayworks as commercial evidence — captured and sent for approval on the same day
          — recover far more of their true labour cost. Those who leave unsigned paper sheets sitting for a week or
          more usually leave money on the table.
        </p>
        <p className="font-bold text-[#0d141b] dark:text-slate-50">
          That same-day, properly linked approach is exactly what Subbie HQ is designed to support.
        </p>
      </section>
    </GuideArticleView>
  );
}
