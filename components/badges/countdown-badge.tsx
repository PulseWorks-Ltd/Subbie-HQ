import { getCountdownInfo } from "@/lib/date-countdown";

const URGENCY_STYLES: Record<string, string> = {
  overdue: "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  today: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  soon: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  upcoming: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
};

export function CountdownBadge({ date }: { date: Date }) {
  const info = getCountdownInfo(date);
  const style = URGENCY_STYLES[info.urgency];

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${style}`}>
      {info.label}
    </span>
  );
}
