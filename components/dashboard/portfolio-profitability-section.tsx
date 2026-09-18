"use client";

import { useState } from "react";
import Link from "next/link";
import type { PortfolioProfitabilitySummary } from "@/lib/project-profitability";
import { DashboardSection } from "@/components/dashboard/dashboard-section";
import { DonutChart } from "@/components/dashboard/donut-chart";

function formatCurrency(amount: number) {
  return amount.toLocaleString("en-NZ", { style: "currency", currency: "NZD", maximumFractionDigits: 0 });
}

function Metric({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-[#4c739a] dark:text-slate-400">{label}</p>
      <p className="text-sm font-bold text-[#0d141b] dark:text-slate-50">{value}</p>
      {hint && <p className="text-[10px] text-[#4c739a] dark:text-slate-400">{hint}</p>}
    </div>
  );
}

// Portfolio-wide "Commercial Position" — the cross-project counterpart to
// the per-project Profitability page (lib/project-profitability.ts owns
// both). Deliberately compact: the goal is a 5-10 second read of overall
// position, not a full report — someone wanting more detail drills into a
// specific project via the breakdown table below.
export function PortfolioProfitabilitySection({ summary }: { summary: PortfolioProfitabilitySummary }) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  const hasMargin = summary.margin.recordedGrossProfit != null;

  return (
    <DashboardSection
      sectionKey="portfolio-profitability"
      label="Portfolio Profitability"
      icon="monitoring"
      itemCount={1}
      defaultExpanded={true}
      badges={
        summary.commercialItemsRequiringReview > 0 ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            {summary.commercialItemsRequiringReview} to review
          </span>
        ) : undefined
      }
    >
      <div className="rounded-xl border border-[#e7edf3] dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
          <div className="flex items-center gap-4 shrink-0">
            <DonutChart
              size={88}
              strokeWidth={14}
              segments={[
                { value: summary.cost.total, colorClassName: "stroke-slate-300 dark:stroke-slate-700", label: "Recorded direct costs" },
                {
                  value: Math.max(summary.margin.recordedGrossProfit ?? 0, 0),
                  colorClassName: "stroke-primary",
                  label: "Recorded gross profit"
                }
              ]}
            />
            <div className="flex flex-col gap-1 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-slate-300 dark:bg-slate-700 shrink-0" />
                Direct costs — {formatCurrency(summary.cost.total)}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-primary shrink-0" />
                Gross profit — {hasMargin ? formatCurrency(summary.margin.recordedGrossProfit ?? 0) : "—"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 flex-1">
            <Metric label="Revised Contract Value" value={formatCurrency(summary.contractValue.revised)} />
            <Metric label="Direct Costs" value={formatCurrency(summary.cost.total)} />
            <Metric
              label="Recorded Gross Profit"
              value={hasMargin ? formatCurrency(summary.margin.recordedGrossProfit ?? 0) : "—"}
            />
            <Metric
              label="Recorded Gross Margin %"
              value={summary.margin.recordedGrossMarginPercent != null ? `${summary.margin.recordedGrossMarginPercent}%` : "—"}
            />
            <Metric label="Claimed to Date" value={formatCurrency(summary.claims.claimedToDate)} />
            <Metric label="Net Claimed to Date" value={formatCurrency(summary.claims.netClaimedToDate)} hint="After retention" />
            <Metric label="Approved Variations" value={formatCurrency(summary.approvedVariationsTotal)} />
            <Metric
              label="Commercial Items Requiring Review"
              value={summary.commercialItemsRequiringReview}
            />
          </div>
        </div>

        <p className="text-[11px] text-[#4c739a] dark:text-slate-400 rounded-lg bg-slate-50 dark:bg-slate-800/50 px-3 py-2">
          Recorded margin reflects Variations &amp; Site Instructions only. Base contract cost is not currently tracked.
        </p>

        {/* Payment Received placeholder — deliberately never computed from
            Claimed/Net Claimed above. See lib/project-profitability.ts's
            header comment for the intended future integration point
            (Payment Claim -> Contractor Payment Schedule -> ... ->
            Outstanding) once that feature exists. */}
        <div className="rounded-lg border border-dashed border-[#cfdbe7] dark:border-slate-700 px-3 py-2 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-[#4c739a] dark:text-slate-400">Payments Received</p>
            <p className="text-[11px] text-[#4c739a] dark:text-slate-400">
              Payment receipt tracking will be added in a future update.
            </p>
          </div>
          <span className="text-xs font-bold text-[#4c739a] dark:text-slate-400 shrink-0">Not yet tracked</span>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowBreakdown((current) => !current)}
            className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
          >
            {showBreakdown ? "Hide" : "Show"} per-project breakdown ({summary.projectCount})
            <span className="material-symbols-outlined text-base">{showBreakdown ? "expand_less" : "expand_more"}</span>
          </button>

          {showBreakdown && (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-[#4c739a] dark:text-slate-400 border-b border-[#e7edf3] dark:border-slate-800">
                    <th className="py-1.5 pr-3">Project</th>
                    <th className="py-1.5 pr-3 text-right">Revised Contract Value</th>
                    <th className="py-1.5 pr-3 text-right">Recorded Cost</th>
                    <th className="py-1.5 pr-3 text-right">Recorded Margin</th>
                    <th className="py-1.5 text-right">Claimed to Date</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.projects.map((project) => (
                    <tr key={project.projectId} className="border-b border-[#e7edf3] dark:border-slate-800 last:border-0">
                      <td className="py-1.5 pr-3">
                        <Link href={`/projects/${project.projectId}/profitability`} className="text-primary hover:underline font-medium">
                          {project.projectName}
                        </Link>
                      </td>
                      <td className="py-1.5 pr-3 text-right">{formatCurrency(project.revisedContractValue)}</td>
                      <td className="py-1.5 pr-3 text-right">{formatCurrency(project.recordedCost)}</td>
                      <td className="py-1.5 pr-3 text-right">
                        {project.recordedMargin != null ? formatCurrency(project.recordedMargin) : "—"}
                      </td>
                      <td className="py-1.5 text-right">{formatCurrency(project.claimedToDate)}</td>
                    </tr>
                  ))}
                  {summary.projects.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-3 text-center text-[#4c739a] dark:text-slate-400">
                        No active projects with commercial data yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardSection>
  );
}
