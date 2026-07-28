"use client";

import type { ContractDeviation, ContractReview } from "@prisma/client";
import { RiskBadge } from "@/components/badges/risk-badge";
import { LegalDisclaimerFooter } from "@/components/contract/legal-disclaimer-footer";

const CLASSIFICATION_LABELS: Record<string, string> = {
  major_deviation: "Major deviation",
  missing_from_subcontract: "Standard protection removed",
  additional_in_subcontract: "Added clause",
  minor_deviation: "Minor deviation",
  matches_standard: "Matches standard"
};

function DeviationCard({ deviation }: { deviation: ContractDeviation }) {
  return (
    <div className="rounded-lg border border-[#e7edf3] dark:border-slate-800 p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400">
            {CLASSIFICATION_LABELS[deviation.classification] ?? deviation.classification}
          </span>
          <p className="text-sm font-bold mt-1.5">
            {deviation.baselineClauseRef ? `SA-2017 ${deviation.baselineClauseRef}` : "No standard-form equivalent"}
            {deviation.baselineClauseTitle ? ` — ${deviation.baselineClauseTitle}` : ""}
          </p>
          {deviation.subcontractClauseRef && (
            <p className="text-xs text-[#4c739a] dark:text-slate-400 mt-0.5">
              Subcontract clause {deviation.subcontractClauseRef}
              {deviation.sourcePage ? ` (p.${deviation.sourcePage})` : ""}
            </p>
          )}
        </div>
        <RiskBadge level={deviation.impact} />
      </div>

      {deviation.subcontractExcerpt && (
        <p className="text-sm italic text-[#4c739a] dark:text-slate-400 leading-relaxed mb-2">
          &ldquo;{deviation.subcontractExcerpt}&rdquo;
        </p>
      )}

      <p className="text-sm leading-relaxed mb-1">{deviation.rationale}</p>
      {deviation.recommendation && (
        <p className="text-sm leading-relaxed text-primary">{deviation.recommendation}</p>
      )}
    </div>
  );
}

function groupByBucket(deviations: ContractDeviation[]) {
  const grouped = new Map<string, ContractDeviation[]>();
  for (const deviation of deviations) {
    const list = grouped.get(deviation.topicBucket) ?? [];
    list.push(deviation);
    grouped.set(deviation.topicBucket, list);
  }
  return grouped;
}

function GroupedDeviationList({
  title,
  deviations,
  noun,
  suffix,
  toneClassName
}: {
  title: string;
  deviations: ContractDeviation[];
  noun: string;
  suffix?: string;
  toneClassName: string;
}) {
  if (deviations.length === 0) return null;
  const grouped = groupByBucket(deviations);

  return (
    <div>
      <h4 className="text-sm font-bold mb-3">{title}</h4>
      <div className="flex flex-col gap-2">
        {Array.from(grouped.entries()).map(([bucket, bucketDeviations]) => (
          <details key={bucket} className="rounded-lg border border-[#e7edf3] dark:border-slate-800 p-3">
            <summary className={`text-sm font-medium cursor-pointer ${toneClassName}`}>
              {bucket.replace(/_/g, " ")} — {bucketDeviations.length} {noun}
              {bucketDeviations.length === 1 ? "" : "s"}
              {suffix ? ` ${suffix}` : ""}
            </summary>
            <div className="flex flex-col gap-2 mt-3">
              {bucketDeviations.map((deviation) => (
                <p key={deviation.id} className="text-sm text-[#4c739a] dark:text-slate-400 leading-relaxed">
                  {deviation.baselineClauseRef ? `${deviation.baselineClauseRef}: ` : ""}
                  {deviation.rationale}
                </p>
              ))}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

export function DeviationReportView({
  review
}: {
  review: ContractReview & { deviations: ContractDeviation[] };
}) {
  if (review.status === "failed") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-red-600">
          {review.errorMessage ?? "Could not complete an automated review of this document. You can still review it manually."}
        </p>
      </div>
    );
  }

  // Actively-different clauses (present in the subcontract, wording/substance
  // differs) get full individual detail — there are typically few of these,
  // and each one is worth reading closely. Absent-clause findings can be very
  // numerous on a short/partial document, so they're grouped by topic instead
  // — a wall of hundreds of "this clause is missing" cards would defeat the
  // "don't overwhelm the user" requirement just as badly as not flagging
  // anything at all.
  const activeDeviations = review.deviations
    .filter((d) => d.classification === "major_deviation" || d.classification === "additional_in_subcontract")
    .sort((a, b) => b.priorityScore - a.priorityScore);
  const missingDeviations = review.deviations.filter((d) => d.classification === "missing_from_subcontract");
  const minorDeviations = review.deviations.filter((d) => d.classification === "minor_deviation");
  const matchCount = review.deviations.filter((d) => d.classification === "matches_standard").length;

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg border border-[#e7edf3] dark:border-slate-800 p-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <h4 className="text-sm font-bold">Review summary</h4>
          {review.overallRiskLevel && <RiskBadge level={review.overallRiskLevel} />}
        </div>
        {review.executiveSummary && (
          <p className="text-sm leading-relaxed text-[#4c739a] dark:text-slate-400">{review.executiveSummary}</p>
        )}
        <p className="text-xs text-[#4c739a] dark:text-slate-400 mt-2">
          {review.majorDeviationCount} major issue{review.majorDeviationCount === 1 ? "" : "s"} ·{" "}
          {review.minorDeviationCount} minor/technical deviation{review.minorDeviationCount === 1 ? "" : "s"} ·{" "}
          {matchCount} clause{matchCount === 1 ? "" : "s"} matched the standard form · compared against{" "}
          {review.standardFormVersion}
        </p>
      </div>

      {activeDeviations.length > 0 && (
        <div>
          <h4 className="text-sm font-bold mb-3">Major Deviations</h4>
          <div className="flex flex-col gap-3">
            {activeDeviations.map((deviation) => (
              <DeviationCard key={deviation.id} deviation={deviation} />
            ))}
          </div>
        </div>
      )}

      <GroupedDeviationList
        title="Standard Protections Not Present"
        deviations={missingDeviations}
        noun="clause"
        suffix="removed or weakened"
        toneClassName="text-red-700 dark:text-red-400"
      />

      <GroupedDeviationList
        title="Minor & Technical Deviations"
        deviations={minorDeviations}
        noun="minor deviation"
        toneClassName=""
      />

      <LegalDisclaimerFooter />
    </div>
  );
}
