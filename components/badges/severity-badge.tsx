// Deliberately separate from RiskBadge (components/badges/risk-badge.tsx),
// which is shared with unrelated features (Project.riskLevel, Clause.riskLevel)
// — this is specifically the Contract Review finding severity tier
// (critical/important/informational), a different vocabulary that
// shouldn't be conflated with the app-wide low/medium/high risk concept.
// Escalating visual weight per tier (Contract Review redesign Task 3.3) —
// critical is solid and loud, important is a clear step down, informational
// is deliberately muted so it doesn't compete for attention.
const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-600 text-white dark:bg-red-600",
  important: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  informational: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: "Critical",
  important: "Important",
  informational: "Informational"
};

export function SeverityBadge({
  severity,
  verbose
}: {
  severity: string;
  // Spec terminology rename: "Major Risk / High Risk" -> "Commercial
  // Impact: Critical" (contract-intelligence-v2-spec.md's terminology
  // table). Only applied where this badge stands alone with no adjacent
  // count/label already spelling out "Critical"/"Important" next to it
  // (e.g. each finding card) — the executive summary's "{count} Critical"
  // strip and the small "{N} critical" category badge already say the
  // word right next to this badge, so prefixing there would just repeat
  // "Commercial Impact: Critical ... Critical" rather than clarify anything.
  verbose?: boolean;
}) {
  const style = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.informational;
  const label = (SEVERITY_LABELS[severity] ?? severity) as string;
  const displayLabel = verbose ? `Commercial Impact: ${label}` : label;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${style}`}>
      {displayLabel}
    </span>
  );
}
