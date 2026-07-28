import Link from "next/link";
import type { DashboardItem, DashboardItemType } from "@/lib/dashboard";
import { DashboardSection } from "@/components/dashboard/dashboard-section";

const SECTIONS: { key: DashboardItemType; label: string; icon: string }[] = [
  { key: "site-instruction", label: "Site Instructions", icon: "assignment" },
  { key: "programme", label: "Programme", icon: "construction" },
  { key: "safety-document", label: "Health & Safety", icon: "health_and_safety" },
  { key: "payment-claim", label: "Payment Claims", icon: "payments" }
];

function sortItems(items: DashboardItem[]) {
  return [...items].sort((a, b) => {
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
    return a.date.getTime() - b.date.getTime();
  });
}

export function DashboardView({ initialItems }: { initialItems: DashboardItem[] }) {
  const sections = SECTIONS.map((section) => {
    const items = sortItems(initialItems.filter((item) => item.type === section.key));
    const overdueCount = items.filter((item) => item.isOverdue).length;
    return {
      ...section,
      items,
      overdueCount,
      upcomingCount: items.length - overdueCount
    };
  })
    .filter((section) => section.items.length > 0)
    .sort((a, b) => {
      if (a.overdueCount > 0 !== b.overdueCount > 0) return a.overdueCount > 0 ? -1 : 1;
      return 0;
    });

  return (
    <main className="flex-1 flex flex-col items-center">
      <div className="max-w-[800px] w-full px-10 py-8">
        <div className="flex flex-wrap justify-between items-end gap-3 mb-6">
          <div className="flex min-w-72 flex-col gap-2">
            <p className="text-[#0d141b] dark:text-slate-50 text-4xl font-black leading-tight tracking-[-0.033em]">
              Dashboard
            </p>
            <p className="text-[#4c739a] dark:text-slate-400 text-base font-normal leading-normal max-w-xl">
              What needs attention across all your projects, next 7 days.
            </p>
          </div>
          <Link
            href="/projects"
            className="flex items-center gap-2 h-10 px-4 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-bold hover:bg-[#e7edf3] dark:hover:bg-slate-800"
          >
            <span className="material-symbols-outlined text-lg">apartment</span>
            View all Projects
          </Link>
        </div>

        {sections.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#cfdbe7] dark:border-slate-700 py-20">
            <div className="size-16 rounded-full bg-[#e7edf3] dark:bg-slate-800 flex items-center justify-center text-[#4c739a] mb-4">
              <span className="material-symbols-outlined text-4xl">check</span>
            </div>
            <p className="text-[#0d141b] dark:text-slate-50 font-bold">Nothing needs attention</p>
            <p className="text-[#4c739a] dark:text-slate-400 text-sm mt-1">
              Nothing overdue, and nothing due in the next 7 days.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {sections.map((section) => (
              <DashboardSection
                key={section.key}
                sectionKey={section.key}
                label={section.label}
                icon={section.icon}
                items={section.items}
                overdueCount={section.overdueCount}
                upcomingCount={section.upcomingCount}
                defaultExpanded={section.overdueCount > 0}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
