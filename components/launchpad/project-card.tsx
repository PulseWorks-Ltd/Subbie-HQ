import Link from "next/link";
import type { LaunchpadProject } from "@/lib/launchpad";
import { CountdownBadge } from "@/components/badges/countdown-badge";

const RISK_STYLES: Record<string, string> = {
  low: "bg-green-500",
  medium: "bg-amber-500",
  high: "bg-red-500"
};

const RISK_LABELS: Record<string, string> = {
  low: "Low Risk",
  medium: "Medium Risk",
  high: "High Risk"
};

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

export function ProjectCard({ project }: { project: LaunchpadProject }) {
  const riskBadge = RISK_STYLES[project.riskLevel] ?? RISK_STYLES.low;
  const riskLabel = RISK_LABELS[project.riskLevel] ?? RISK_LABELS.low;

  return (
    <div className="flex flex-col bg-white dark:bg-slate-900 rounded-xl overflow-hidden border border-[#cfdbe7] dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
      <div className="p-5 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-[#0d141b] dark:text-slate-50 text-lg font-bold leading-tight">{project.name}</h3>
          <span className={`shrink-0 ${riskBadge} text-white text-[10px] font-black px-2 py-1 rounded uppercase tracking-wider`}>
            {riskLabel}
          </span>
        </div>

        {project.code && (
          <p className="text-xs font-semibold text-[#4c739a] dark:text-slate-400 mb-3">{project.code}</p>
        )}

        <div className="flex-1 flex flex-col gap-3 pt-1">
          <div className="flex flex-col gap-1">
            <p className="text-[#4c739a] dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
              Next Payment Claim
            </p>
            <div className="flex items-center gap-2 text-primary font-bold">
              <span className="material-symbols-outlined text-lg">calendar_today</span>
              <span className="text-base">
                {project.nextPaymentClaimDate ? formatDate(project.nextPaymentClaimDate) : "Not scheduled"}
              </span>
              {project.nextPaymentClaimDate && <CountdownBadge date={project.nextPaymentClaimDate} />}
            </div>
          </div>

          {project.nextSiteInstructionDueDate && (
            <div className="flex flex-col gap-1">
              <p className="text-[#4c739a] dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                Next SI / NTS Due
              </p>
              <div className="flex items-center gap-2 font-bold">
                <span className="material-symbols-outlined text-lg text-[#4c739a]">assignment</span>
                <span className="text-sm">{formatDate(project.nextSiteInstructionDueDate)}</span>
                <CountdownBadge date={project.nextSiteInstructionDueDate} />
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 pt-4 border-t border-[#e7edf3] dark:border-slate-800">
          <Link
            href={`/projects/${project.id}`}
            className="block w-full text-center py-2 bg-[#f0f7ff] dark:bg-primary/10 text-primary font-bold text-sm rounded-lg hover:bg-primary hover:text-white transition-all"
          >
            View Project Details
          </Link>
        </div>
      </div>
    </div>
  );
}
