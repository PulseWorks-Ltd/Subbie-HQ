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

export function SeverityBadge({ severity }: { severity: string }) {
  const style = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.informational;
  const label = SEVERITY_LABELS[severity] ?? severity;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${style}`}>
      {label}
    </span>
  );
}
