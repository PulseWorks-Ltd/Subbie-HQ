import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Subbie HQ vs Spreadsheets and Paper Records | Subcontractor Software",
  description: "Why subcontractors are moving from spreadsheets and paper dayworks sheets to Subbie HQ."
};

const ROWS: { label: string; before: string; after: string }[] = [
  { label: "Site Instructions", before: "Text messages, memory", after: "Logged and timestamped instantly" },
  { label: "Dayworks", before: "Re-typed by hand", after: "Photographed, read automatically" },
  {
    label: "Variation evidence",
    before: "Scattered across email, photos, paper",
    after: "Bundled into one document"
  },
  { label: "Contract review", before: "Read it yourself, or pay a lawyer", after: "Plain-English breakdown in minutes" },
  { label: "Cost", before: "“Free” (until a claim falls apart)", after: "From $49/month" }
];

export default function SpreadsheetsAndPaperComparisonPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-6">
        You&apos;ve Been Running Your Business on Spreadsheets and Paper. Here&apos;s What Changes.
      </h1>

      <section className="mb-10">
        <h2 className="text-lg font-bold mb-2">
          Spreadsheets and paper work — until something goes wrong.
        </h2>
        <p className="text-[#4c739a] dark:text-slate-400">
          A dayworks sheet in a ute. A variation tracked in a notebook. An instruction that was only ever a text
          message. It works, until a disputed claim needs evidence from three months ago and nobody can find
          half of it.
        </p>
      </section>

      <div className="overflow-x-auto mb-10">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-[#cfdbe7] dark:border-slate-800">
              <th className="text-left font-bold py-2 pr-4"></th>
              <th className="text-left font-bold py-2 px-4">Spreadsheets & Paper</th>
              <th className="text-left font-bold py-2 px-4">Subbie HQ</th>
            </tr>
          </thead>
          <tbody className="text-[#4c739a] dark:text-slate-400">
            {ROWS.map((row) => (
              <tr key={row.label} className="border-b border-[#e7edf3] dark:border-slate-800 last:border-0">
                <td className="py-2 pr-4 font-medium text-[#0d141b] dark:text-slate-50">{row.label}</td>
                <td className="py-2 px-4">{row.before}</td>
                <td className="py-2 px-4">{row.after}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/signup"
          className="h-11 px-6 flex items-center justify-center rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90"
        >
          Start Free Trial
        </Link>
        <Link
          href="/pricing"
          className="h-11 px-6 flex items-center justify-center rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-bold hover:bg-[#e7edf3] dark:hover:bg-slate-800"
        >
          See Pricing
        </Link>
      </div>
    </div>
  );
}
