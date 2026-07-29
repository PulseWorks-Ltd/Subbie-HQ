import type { CoverComparisonRow } from "@/lib/insurance-cover-comparison";

const STATUS_STYLES: Record<CoverComparisonRow["status"], string> = {
  sufficient: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  insufficient: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  missing: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
};

const STATUS_LABELS: Record<CoverComparisonRow["status"], string> = {
  sufficient: "Sufficient",
  insufficient: "Insufficient",
  missing: "Missing"
};

function formatValue(value: number) {
  return `$${value.toLocaleString("en-NZ")}`;
}

export function InsuranceCoverComparison({ rows }: { rows: CoverComparisonRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#cfdbe7] dark:border-slate-800 p-5">
      <h3 className="text-sm font-bold mb-1">Insurance cover required by this contract</h3>
      <p className="text-xs text-[#4c739a] dark:text-slate-400 mb-3">
        Compared against your company's currently held certificates — updates automatically when a certificate is
        renewed.
      </p>
      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <div
            key={row.coverType}
            className="flex items-center justify-between gap-3 rounded-lg border border-[#e7edf3] dark:border-slate-800 p-3"
          >
            <div>
              <p className="text-sm font-bold">{row.coverType}</p>
              <p className="text-xs text-[#4c739a] dark:text-slate-400">
                Required {formatValue(row.requiredValue)}
                {row.heldValue !== null && ` · Held ${formatValue(row.heldValue)}`}
              </p>
            </div>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide shrink-0 ${STATUS_STYLES[row.status]}`}>
              {STATUS_LABELS[row.status]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
