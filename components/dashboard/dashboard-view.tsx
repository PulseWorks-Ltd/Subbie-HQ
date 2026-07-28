import Link from "next/link";
import type { DashboardItem } from "@/lib/dashboard";
import { DashboardItemRow } from "@/components/dashboard/dashboard-item-row";

export function DashboardView({ initialItems }: { initialItems: DashboardItem[] }) {
  const overdueItems = initialItems.filter((item) => item.isOverdue);
  const upcomingItems = initialItems.filter((item) => !item.isOverdue);

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

        {initialItems.length === 0 ? (
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
          <div className="flex flex-col gap-8">
            {overdueItems.length > 0 && (
              <div className="flex flex-col gap-3">
                <h2 className="text-sm font-bold uppercase tracking-wide text-red-600 dark:text-red-400">
                  Needs attention ({overdueItems.length})
                </h2>
                <div className="flex flex-col gap-2">
                  {overdueItems.map((item) => (
                    <DashboardItemRow key={`${item.type}-${item.id}`} item={item} />
                  ))}
                </div>
              </div>
            )}

            {upcomingItems.length > 0 && (
              <div className="flex flex-col gap-3">
                <h2 className="text-sm font-bold uppercase tracking-wide text-[#4c739a] dark:text-slate-400">
                  Next 7 days ({upcomingItems.length})
                </h2>
                <div className="flex flex-col gap-2">
                  {upcomingItems.map((item) => (
                    <DashboardItemRow key={`${item.type}-${item.id}`} item={item} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
