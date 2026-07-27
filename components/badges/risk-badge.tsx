const RISK_STYLES: Record<string, string> = {
  low: "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400",
  medium: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  high: "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
};

const RISK_LABELS: Record<string, string> = {
  low: "Low Risk",
  medium: "Medium Risk",
  high: "High Risk"
};

export function RiskBadge({ level }: { level: string }) {
  const style = RISK_STYLES[level] ?? RISK_STYLES.low;
  const label = RISK_LABELS[level] ?? level;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${style}`}>
      {label}
    </span>
  );
}
