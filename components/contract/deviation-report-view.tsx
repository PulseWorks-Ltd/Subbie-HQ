"use client";

import { useState } from "react";
import type { ContractDeviation } from "@prisma/client";
import { SeverityBadge } from "@/components/badges/severity-badge";
import { DashboardSection } from "@/components/dashboard/dashboard-section";
import { findingCategoryLabel, findingCategoryIcon } from "@/lib/finding-categories";
import { LegalDisclaimerFooter } from "@/components/contract/legal-disclaimer-footer";
import { ResponseLetterDrafting } from "@/components/contract/response-letter-drafting";
import type { ReviewWithChain } from "@/components/contract/contract-review-section";

// Contract Review redesign Phase 1 terminology (Task 1.3) — labels only,
// the underlying DeviationClassification enum values are unchanged.
// Applied uniformly to both baseline and prior-contract comparisons (the
// task frames these as a single renamed vocabulary, not two).
// minor_deviation deliberately shares major_deviation's "New Obligation"
// label rather than getting its own "minor" wording (bug fix, Contract
// Review Phase 1 completion, Task 2.1) — this badge now only describes
// WHAT KIND of finding it is (a changed/new obligation vs a removed
// protection vs an added requirement vs a match); how much it matters is
// entirely the separate severity badge's job (critical/important/
// informational), so a major/minor split on this badge would just
// duplicate and potentially contradict that signal.
const CLASSIFICATION_LABELS: Record<string, string> = {
  major_deviation: "New Obligation",
  missing_from_subcontract: "Standard protection removed",
  additional_in_subcontract: "Additional Requirement",
  minor_deviation: "New Obligation",
  matches_standard: "Matches standard"
};

const SEVERITY_ORDER: Record<string, number> = { critical: 0, important: 1, informational: 2 };

function DeviationCard({
  deviation,
  selectable,
  selected,
  onToggle
}: {
  deviation: ContractDeviation;
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
              {CLASSIFICATION_LABELS[deviation.classification] ?? deviation.classification}
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
        {deviation.severity && <SeverityBadge severity={deviation.severity} />}
      </div>

      {deviation.subcontractExcerpt && (
        <p className="text-sm italic text-[#4c739a] dark:text-slate-400 leading-relaxed mb-2">
          &ldquo;{deviation.subcontractExcerpt}&rdquo;
        </p>
      )}

      <p className="text-sm leading-relaxed mb-1">{deviation.rationale}</p>
      {deviation.recommendation && (
        <div className="mt-2">
          <p className="text-xs font-bold uppercase tracking-wide text-primary/70">What you should do</p>
          <p className="text-sm leading-relaxed text-primary">{deviation.recommendation}</p>
        </div>
      )}
    </div>
  );
}

function sortBySeverityThenPriority(deviations: ContractDeviation[]): ContractDeviation[] {
  return [...deviations].sort((a, b) => {
    const severityDiff = (SEVERITY_ORDER[a.severity ?? "informational"] ?? 3) - (SEVERITY_ORDER[b.severity ?? "informational"] ?? 3);
    if (severityDiff !== 0) return severityDiff;
    return b.priorityScore - a.priorityScore;
  });
}

// Groups findings under their category (Task 3.1), sorted CRITICAL first
// within each group (Task 3.2), with categories themselves ordered by
// where the real risk concentrates — most Critical findings first, ties
// broken by Important count — so a user scanning top-to-bottom sees the
// highest-stakes category first.
function groupByCategory(deviations: ContractDeviation[]): { category: string; deviations: ContractDeviation[] }[] {
  const grouped = new Map<string, ContractDeviation[]>();
  for (const deviation of deviations) {
    const key = deviation.category ?? "other";
    const list = grouped.get(key) ?? [];
    list.push(deviation);
    grouped.set(key, list);
  }

  const groups = Array.from(grouped.entries()).map(([category, categoryDeviations]) => ({
    category,
    deviations: sortBySeverityThenPriority(categoryDeviations)
  }));

  function severityCount(group: { deviations: ContractDeviation[] }, severity: string) {
    return group.deviations.filter((d) => d.severity === severity).length;
  }

  return groups.sort(
    (a, b) => severityCount(b, "critical") - severityCount(a, "critical") || severityCount(b, "important") - severityCount(a, "important")
  );
}

type PositiveFinding = { title: string; context: string };

// review.positiveFindings is a Prisma Json? column (see prisma/schema.prisma)
// — validated defensively at read time rather than trusted blindly, since
// its shape is only enforced by lib/grok.ts's zod schema at write time, not
// by the database column itself.
function parsePositiveFindings(value: unknown): PositiveFinding[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is PositiveFinding => {
    if (typeof item !== "object" || item === null) return false;
    const record = item as Record<string, unknown>;
    return typeof record.title === "string" && typeof record.context === "string";
  });
}

type CategorySummary = { whatThisMeans: string; keyRisks: string[]; protectYourself: string[] };

// review.categorySummaries is a Prisma Json? column (Phase 1.75) — same
// defensive-read reasoning as parsePositiveFindings above: only enforced
// by lib/grok.ts's zod schema at write time, not by the database column
// itself. Reviews generated before this shipped have this null/undefined,
// and any entry that fails validation here is simply dropped rather than
// crashing the page — a missing entry for a given category is exactly how
// the UI decides to fall back to the pre-Phase-1.75 flat findings list for
// that category (see DeviationReportView's categoryGroups.map below).
function parseCategorySummaries(value: unknown): Record<string, CategorySummary> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const result: Record<string, CategorySummary> = {};
  for (const [category, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const keyRisks = record.keyRisks;
    const protectYourself = record.protectYourself;
    if (
      typeof record.whatThisMeans === "string" &&
      Array.isArray(keyRisks) &&
      keyRisks.every((item) => typeof item === "string") &&
      Array.isArray(protectYourself) &&
      protectYourself.every((item) => typeof item === "string")
    ) {
      result[category] = {
        whatThisMeans: record.whatThisMeans,
        keyRisks: keyRisks as string[],
        protectYourself: protectYourself as string[]
      };
    }
  }
  return result;
}

function ExecutiveSummary({ review }: { review: ReviewWithChain }) {
  const severityCounts = { critical: 0, important: 0, informational: 0 };
  for (const d of review.deviations) {
    if (d.severity) severityCounts[d.severity as keyof typeof severityCounts]++;
  }

  const categoryGroups = groupByCategory(review.deviations);
  // "other" is never a meaningful place to tell a subcontractor to start
  // (bug fix, Task 1.3) — excluded here as a hard rule, not merely a
  // consequence of "other" becoming rare after the taxonomy fix, since
  // categoryGroups is already sorted by critical count descending, this
  // still picks the non-"other" category with the most critical findings.
  const topCriticalCategory = categoryGroups.find(
    (g) => g.category !== "other" && g.deviations.some((d) => d.severity === "critical")
  );
  const positiveFindings = parsePositiveFindings(review.positiveFindings);

  return (
    <div className="rounded-lg border border-[#e7edf3] dark:border-slate-800 p-4">
      <h4 className="text-sm font-bold mb-2">What This Contract Expects From You</h4>
      {review.executiveSummary && (
        <p className="text-sm leading-relaxed text-[#4c739a] dark:text-slate-400 mb-3">{review.executiveSummary}</p>
      )}

      {review.keyObservations.length > 0 && (
        <ul className="list-disc list-inside text-sm text-[#4c739a] dark:text-slate-400 mb-3 space-y-0.5">
          {review.keyObservations.map((observation, index) => (
            <li key={index}>{observation}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-3 mb-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold">
          <SeverityBadge severity="critical" />
          {severityCounts.critical} Critical
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs font-bold">
          <SeverityBadge severity="important" />
          {severityCounts.important} Important
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs font-bold">
          <SeverityBadge severity="informational" />
          {severityCounts.informational} Informational
        </span>
      </div>

      {categoryGroups.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#4c739a] dark:text-slate-400 mb-3">
          {categoryGroups
            .filter((g) => g.deviations.some((d) => d.severity === "critical" || d.severity === "important"))
            .map((g) => {
              const critical = g.deviations.filter((d) => d.severity === "critical").length;
              const important = g.deviations.filter((d) => d.severity === "important").length;
              return (
                <span key={g.category}>
                  <span className="font-medium">{findingCategoryLabel(g.category)}:</span>{" "}
                  {critical > 0 && `${critical} critical`}
                  {critical > 0 && important > 0 && ", "}
                  {important > 0 && `${important} important`}
                </span>
              );
            })}
        </div>
      )}

      {topCriticalCategory && (
        <p className="text-sm font-medium text-red-700 dark:text-red-400">
          Start with {findingCategoryLabel(topCriticalCategory.category)} — it has the most critical items.
        </p>
      )}

      {positiveFindings.length > 0 && (
        <div className="mt-4 pt-3 border-t border-[#e7edf3] dark:border-slate-800">
          <h5 className="text-xs font-bold uppercase tracking-wide text-green-700 dark:text-green-400 mb-2">
            Things Working In Your Favour
          </h5>
          <div className="flex flex-col gap-2">
            {positiveFindings.map((finding, index) => (
              <div key={index} className="text-sm">
                <span className="font-bold">{finding.title}.</span>{" "}
                <span className="text-[#4c739a] dark:text-slate-400">{finding.context}</span>
              </div>
            ))}
          </div>
        </div>
      )}
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

  // Findings from before the Contract Review redesign (Phase 1) predate the
  // category/severity fields and have both null on every row — rather than
  // attempting to mix old and new display formats (explicitly ruled out,
  // see Task 1.4), point the user at the "Re-run Review" action already
  // rendered just above this component (see contract-review-section.tsx).
  const isPreRedesignReview = review.deviations.length > 0 && review.deviations.every((d) => d.severity === null);
  if (isPreRedesignReview) {
    return (
      <div className="rounded-lg border-2 border-dashed border-[#cfdbe7] dark:border-slate-700 p-5 text-center">
        <p className="text-sm font-bold mb-1">This review predates the new severity &amp; category breakdown</p>
        <p className="text-sm text-[#4c739a] dark:text-slate-400">
          Findings were generated before this update. Use &ldquo;Re-run Review&rdquo; above to get the new Critical /
          Important / Informational breakdown grouped by category.
        </p>
      </div>
    );
  }

  const isPriorContractComparison = review.comparedAgainstType === "prior_contract";

  const comparisonTargetLabel = isPriorContractComparison
    ? `their previous contract on this project (${review.comparedAgainstReview?.document.fileName ?? review.comparedAgainstReview?.document.title ?? "an earlier document"}${
        review.comparedAgainstReview
          ? `, reviewed ${new Date(review.comparedAgainstReview.document.uploadedAt).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })}`
          : ""
      })`
    : review.standardFormVersion;

  const categoryGroups = groupByCategory(review.deviations);
  const categorySummaries = parseCategorySummaries(review.categorySummaries);
  const selectableDeviations = [...review.deviations, ...review.driftDeviations];

  return (
    <div className="flex flex-col gap-5">
      <ExecutiveSummary review={review} />

      <p className="text-xs text-[#4c739a] dark:text-slate-400 -mt-3">Compared against {comparisonTargetLabel}.</p>

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
                selectable
                selected={selectedIds.includes(deviation.id)}
                onToggle={toggle}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {categoryGroups.map(({ category, deviations }) => {
          const criticalCount = deviations.filter((d) => d.severity === "critical").length;
          const summary = categorySummaries[category];
          const clauseList = (
            <div className="flex flex-col gap-3">
              {deviations.map((deviation) => (
                <DeviationCard
                  key={deviation.id}
                  deviation={deviation}
                  selectable
                  selected={selectedIds.includes(deviation.id)}
                  onToggle={toggle}
                />
              ))}
            </div>
          );

          return (
            <DashboardSection
              key={category}
              sectionKey={`contract-review-category-${category}`}
              label={`${findingCategoryLabel(category)} (${deviations.length})`}
              icon={findingCategoryIcon(category)}
              itemCount={deviations.length}
              defaultExpanded={criticalCount > 0}
              badges={
                criticalCount > 0 ? (
                  <span className="text-[10px] font-bold text-red-600 dark:text-red-400">{criticalCount} critical</span>
                ) : undefined
              }
            >
              {summary ? (
                <div className="flex flex-col gap-4">
                  <div>
                    <h5 className="text-xs font-bold uppercase tracking-wide text-[#4c739a] dark:text-slate-400 mb-1.5">
                      What This Means
                    </h5>
                    <div className="flex flex-col gap-2">
                      {summary.whatThisMeans
                        .split(/\n+/)
                        .map((paragraph) => paragraph.trim())
                        .filter(Boolean)
                        .map((paragraph, index) => (
                          <p key={index} className="text-sm leading-relaxed">
                            {paragraph}
                          </p>
                        ))}
                    </div>
                  </div>

                  {summary.keyRisks.length > 0 && (
                    <div>
                      <h5 className="text-xs font-bold uppercase tracking-wide text-[#4c739a] dark:text-slate-400 mb-1.5">
                        Key Risks
                      </h5>
                      <ul className="list-disc list-inside text-sm leading-relaxed space-y-1">
                        {summary.keyRisks.map((risk, index) => (
                          <li key={index}>{risk}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {summary.protectYourself.length > 0 && (
                    <div>
                      <h5 className="text-xs font-bold uppercase tracking-wide text-primary/70 mb-1.5">
                        How to Protect Yourself
                      </h5>
                      <ul className="list-disc list-inside text-sm leading-relaxed text-primary space-y-1">
                        {summary.protectYourself.map((action, index) => (
                          <li key={index}>{action}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <DashboardSection
                    sectionKey={`contract-review-category-${category}-clauses`}
                    label={`Supporting Clause Analysis (${deviations.length})`}
                    icon="fact_check"
                    itemCount={deviations.length}
                    defaultExpanded={false}
                  >
                    {clauseList}
                  </DashboardSection>
                </div>
              ) : (
                // Backward compatibility (Task 3.2) — reviews generated
                // before Phase 1.75 (or any category the model omitted a
                // summary for) have no categorySummaries entry here, so
                // this falls back to the pre-Phase-1.75 flat findings list
                // with no summary layer, rather than a broken/empty block.
                clauseList
              )}
            </DashboardSection>
          );
        })}
      </div>

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
