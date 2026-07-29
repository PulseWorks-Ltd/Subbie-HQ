"use client";

import { useState } from "react";
import type { ContractDeviation } from "@prisma/client";
import { RiskBadge } from "@/components/badges/risk-badge";
import { LegalDisclaimerFooter } from "@/components/contract/legal-disclaimer-footer";
import { ResponseLetterDrafting } from "@/components/contract/response-letter-drafting";
import type { ReviewWithChain } from "@/components/contract/contract-review-section";

const CLASSIFICATION_LABELS: Record<string, string> = {
  major_deviation: "Major deviation",
  missing_from_subcontract: "Standard protection removed",
  additional_in_subcontract: "Added clause",
  minor_deviation: "Minor deviation",
  matches_standard: "Matches standard"
};

const PRIOR_CONTRACT_CLASSIFICATION_LABELS: Record<string, string> = {
  major_deviation: "Materially changed",
  missing_from_subcontract: "Removed since last contract",
  additional_in_subcontract: "New clause added",
  minor_deviation: "Minor wording change",
  matches_standard: "Unchanged"
};

function DeviationCard({
  deviation,
  labels,
  selectable,
  selected,
  onToggle
}: {
  deviation: ContractDeviation;
  labels: Record<string, string>;
  selectable: boolean;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-[#e7edf3] dark:border-slate-800 p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-start gap-2">
          {selectable && (
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggle(deviation.id)}
              className="mt-1 size-4 rounded border-[#e7edf3] dark:border-slate-700 shrink-0"
              aria-label="Select for response letter"
            />
          )}
          <div>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400">
              {labels[deviation.classification] ?? deviation.classification}
            </span>
            <p className="text-sm font-bold mt-1.5">
              {deviation.baselineClauseRef ? `${deviation.baselineClauseRef}` : "No equivalent"}
              {deviation.baselineClauseTitle ? ` — ${deviation.baselineClauseTitle}` : ""}
            </p>
            {deviation.subcontractClauseRef && (
              <p className="text-xs text-[#4c739a] dark:text-slate-400 mt-0.5">
                Subcontract clause {deviation.subcontractClauseRef}
                {deviation.sourcePage ? ` (p.${deviation.sourcePage})` : ""}
              </p>
            )}
          </div>
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
  toneClassName,
  selectedIds,
  onToggle
}: {
  title: string;
  deviations: ContractDeviation[];
  noun: string;
  suffix?: string;
  toneClassName: string;
  selectedIds: string[];
  onToggle: (id: string) => void;
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
                <label key={deviation.id} className="flex items-start gap-2 text-sm text-[#4c739a] dark:text-slate-400 leading-relaxed cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(deviation.id)}
                    onChange={() => onToggle(deviation.id)}
                    className="mt-0.5 size-4 rounded border-[#e7edf3] dark:border-slate-700 shrink-0"
                  />
                  <span>
                    {deviation.baselineClauseRef ? `${deviation.baselineClauseRef}: ` : ""}
                    {deviation.rationale}
                  </span>
                </label>
              ))}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

export function DeviationReportView({
  projectId,
  documentId,
  review
}: {
  projectId: string;
  documentId: string;
  review: ReviewWithChain;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  function toggle(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((i) => i !== id) : [...current, id]));
  }

  if (review.status === "failed") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-red-600">
          {review.errorMessage ?? "Could not complete an automated review of this document. You can still review it manually."}
        </p>
      </div>
    );
  }

  const isPriorContractComparison = review.comparedAgainstType === "prior_contract";
  const labels = isPriorContractComparison ? PRIOR_CONTRACT_CLASSIFICATION_LABELS : CLASSIFICATION_LABELS;

  const comparisonTargetLabel = isPriorContractComparison
    ? `their previous contract on this project (${review.comparedAgainstReview?.document.fileName ?? review.comparedAgainstReview?.document.title ?? "an earlier document"}${
        review.comparedAgainstReview
          ? `, reviewed ${new Date(review.comparedAgainstReview.document.uploadedAt).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })}`
          : ""
      })`
    : review.standardFormVersion;

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

  const selectableDeviations = [...activeDeviations, ...missingDeviations, ...minorDeviations, ...review.driftDeviations];

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
          {matchCount} clause{matchCount === 1 ? "" : "s"} matched · compared against {comparisonTargetLabel}
        </p>
      </div>

      {review.newBaselineDriftCount > 0 && (
        <div className="rounded-lg border-2 border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/30 p-4">
          <p className="text-sm font-bold text-amber-800 dark:text-amber-300 mb-1">
            ⚠ This Main Contractor may have changed their own template
          </p>
          <p className="text-xs text-amber-800/90 dark:text-amber-300/90 mb-3">
            {review.newBaselineDriftCount} clause{review.newBaselineDriftCount === 1 ? "" : "s"} in this contract now
            deviate{review.newBaselineDriftCount === 1 ? "s" : ""} from the SA-2017 standard form in ways their
            previous contract with you didn't — worth a closer look even though the comparison above is against
            your last contract, not the standard form.
          </p>
          <div className="flex flex-col gap-2">
            {review.driftDeviations.map((deviation) => (
              <DeviationCard
                key={deviation.id}
                deviation={deviation}
                labels={CLASSIFICATION_LABELS}
                selectable
                selected={selectedIds.includes(deviation.id)}
                onToggle={toggle}
              />
            ))}
          </div>
        </div>
      )}

      {activeDeviations.length > 0 && (
        <div>
          <h4 className="text-sm font-bold mb-3">Major Deviations</h4>
          <div className="flex flex-col gap-3">
            {activeDeviations.map((deviation) => (
              <DeviationCard
                key={deviation.id}
                deviation={deviation}
                labels={labels}
                selectable
                selected={selectedIds.includes(deviation.id)}
                onToggle={toggle}
              />
            ))}
          </div>
        </div>
      )}

      <GroupedDeviationList
        title={isPriorContractComparison ? "Removed Since Last Contract" : "Standard Protections Not Present"}
        deviations={missingDeviations}
        noun="clause"
        suffix={isPriorContractComparison ? "removed" : "removed or weakened"}
        toneClassName="text-red-700 dark:text-red-400"
        selectedIds={selectedIds}
        onToggle={toggle}
      />

      <GroupedDeviationList
        title="Minor & Technical Deviations"
        deviations={minorDeviations}
        noun="minor deviation"
        toneClassName=""
        selectedIds={selectedIds}
        onToggle={toggle}
      />

      <ResponseLetterDrafting
        projectId={projectId}
        documentId={documentId}
        contractReviewId={review.id}
        selectedIds={selectedIds}
        selectableCount={selectableDeviations.length}
        onClear={() => setSelectedIds([])}
      />

      <LegalDisclaimerFooter />
    </div>
  );
}
