"use client";

import { useState } from "react";
import type { ProjectProfitabilitySummary } from "@/lib/project-profitability";
import type { CommercialReviewFeedItem } from "@/lib/commercial-review";
import { DonutChart } from "@/components/dashboard/donut-chart";
import { CommercialReviewItemRow } from "@/components/dashboard/commercial-review-item-row";

function formatCurrency(amount: number) {
  return amount.toLocaleString("en-NZ", { style: "currency", currency: "NZD" });
}
function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

function Metric({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#4c739a] dark:text-slate-400">{label}</p>
      <p className="text-base font-bold text-[#0d141b] dark:text-slate-50">{value}</p>
      {hint && <p className="text-[11px] text-[#4c739a] dark:text-slate-400">{hint}</p>}
    </div>
  );
}

export function ProfitabilityView({
  summary,
  commercialReviewItems,
  showCommercialReview
}: {
  summary: ProjectProfitabilitySummary;
  commercialReviewItems: CommercialReviewFeedItem[];
  showCommercialReview: boolean;
}) {
  const [items, setItems] = useState(commercialReviewItems);
  const hasMargin = summary.margin.recordedMarginOnVariations != null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold">Profitability</h2>
        <p className="text-sm text-[#4c739a] dark:text-slate-400 mt-1">
          {summary.isFrozen
            ? `Frozen as of ${formatDate(summary.asOfDate)} — this project is completed/closed, so figures no longer change.`
            : `Live figures as of ${formatDate(summary.asOfDate)}.`}
        </p>
      </div>

      <div className="rounded-xl border border-[#e7edf3] dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
          <div className="flex items-center gap-4 shrink-0">
            <DonutChart
              size={96}
              strokeWidth={14}
              segments={[
                { value: summary.cost.total, colorClassName: "stroke-slate-300 dark:stroke-slate-700", label: "Recorded direct costs" },
                {
                  value: Math.max(summary.margin.recordedMarginOnVariations ?? 0, 0),
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
                Gross profit — {hasMargin ? formatCurrency(summary.margin.recordedMarginOnVariations ?? 0) : "—"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 flex-1">
            <Metric
              label="Original Contract Value"
              value={summary.hasContractSchedule ? formatCurrency(summary.contractValue.original) : "Not tracked"}
              hint={!summary.hasContractSchedule ? "No Contract Schedule set up" : undefined}
            />
            <Metric label="Approved Variations" value={formatCurrency(summary.contractValue.approvedVariations)} />
            <Metric label="Revised Contract Value" value={formatCurrency(summary.contractValue.revised)} />
            <Metric label="Awaiting Approval" value={formatCurrency(summary.contractValue.awaitingApprovalVariations)} />
            <Metric label="Claimed to Date" value={formatCurrency(summary.claims.claimedToDate)} />
            <Metric label="Retention Withheld" value={formatCurrency(summary.claims.retentionWithheld)} />
            <Metric label="Net Claimed to Date" value={formatCurrency(summary.claims.netClaimedToDate)} />
            <Metric
              label="Recorded Gross Margin %"
              value={summary.margin.recordedMarginPercent != null ? `${summary.margin.recordedMarginPercent}%` : "—"}
            />
          </div>
        </div>

        <p className="text-[11px] text-[#4c739a] dark:text-slate-400 rounded-lg bg-slate-50 dark:bg-slate-800/50 px-3 py-2">
          Recorded margin reflects Variations &amp; Site Instructions only. Base contract cost is not currently tracked.
        </p>

        <div className="rounded-lg border border-[#e7edf3] dark:border-slate-800 px-3 py-2 flex flex-col gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#4c739a] dark:text-slate-400">
            Claimed → Certified → Received
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2">
            <Metric label="Certified to Date" value={formatCurrency(summary.claims.payments.certifiedToDate)} />
            <Metric label="Received to Date" value={formatCurrency(summary.claims.payments.receivedToDate)} />
            <Metric label="Outstanding (Confirmed)" value={formatCurrency(summary.claims.payments.outstanding)} />
            <Metric
              label="Uncertified"
              value={formatCurrency(summary.claims.payments.uncertifiedToDate)}
              hint={
                summary.claims.payments.uncertifiedToDate < 0
                  ? "Certified exceeds recorded claimed value — worth checking"
                  : "Claimed but not yet certified"
              }
            />
          </div>
          {summary.claims.payments.awaitingReceiptConfirmation > 0 && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400">
              {formatCurrency(summary.claims.payments.awaitingReceiptConfirmation)} is certified but hasn&apos;t had a payment
              recorded yet — never assumed as received or outstanding.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-[#e7edf3] dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <h3 className="text-sm font-bold mb-3">Recorded Cost Breakdown — Variations &amp; Site Instructions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Metric label="Labour" value={formatCurrency(summary.cost.labour)} />
          <Metric label="Materials" value={formatCurrency(summary.cost.materials)} />
          <Metric label="Materials Markup" value={formatCurrency(summary.cost.materialsMarkup)} />
          <Metric label="Plant" value={formatCurrency(summary.cost.plant)} />
        </div>
        {summary.cost.hoursMissingRateTotal > 0 && (
          <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-3">
            {summary.cost.hoursMissingRateTotal} recorded hours have no rate set and are excluded from the Labour figure above.
          </p>
        )}
      </div>

      {summary.unpricedSiteInstructions.count > 0 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/10 p-4">
          <h3 className="text-sm font-bold text-amber-900 dark:text-amber-300">Cost Recorded, Not Yet Priced</h3>
          <p className="text-xs text-amber-800 dark:text-amber-400 mt-1">
            Cost recorded on Site Instructions not yet priced as Variations:{" "}
            {formatCurrency(summary.unpricedSiteInstructions.recordedCost)} ({summary.unpricedSiteInstructions.count} item
            {summary.unpricedSiteInstructions.count === 1 ? "" : "s"}).
          </p>
        </div>
      )}

      {showCommercialReview && items.length > 0 && (
        <div>
          <h3 className="text-sm font-bold mb-3">Commercial Items Requiring Review</h3>
          <div className="flex flex-col gap-2">
            {items.map((item) => (
              <CommercialReviewItemRow
                key={item.id}
                item={item}
                onResolved={(id) => setItems((current) => current.filter((existing) => existing.id !== id))}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
