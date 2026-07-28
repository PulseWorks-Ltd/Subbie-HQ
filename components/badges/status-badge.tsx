const STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  parsed: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  confirmed: "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400",
  open: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  submitted_for_claim: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  complete: "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  parsed: "Parsed",
  confirmed: "Confirmed",
  open: "Open",
  submitted_for_claim: "Submitted for Claim",
  complete: "Complete"
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.draft;
  const label = STATUS_LABELS[status] ?? status;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${style}`}>
      {label}
    </span>
  );
}
