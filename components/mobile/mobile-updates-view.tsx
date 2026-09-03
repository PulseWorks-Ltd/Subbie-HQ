"use client";

import { useEffect } from "react";
import type { Update, UpdateAttachment, VariationItem } from "@prisma/client";
import type { TaggableContractItem } from "@/lib/contract-schedule";
import { MobileThread } from "@/components/mobile/mobile-thread";
import { UpdateComposer } from "@/components/updates/update-composer";
import { UpdatesSearchBar } from "@/components/updates/updates-search-bar";
import { getCountdownInfo } from "@/lib/date-countdown";

type Author = { id: string; firstName: string | null; lastName: string | null; email: string };
type VariationItemRef = { id: string; reference: string; title: string };
type UpdateWithReplies = Update & {
  author: Author;
  variationItem: VariationItemRef | null;
  qaRecord: { id: string; stage: string } | null;
  attachments: UpdateAttachment[];
  replies: (Update & { author: Author; attachments: UpdateAttachment[] })[];
};
type ContactOption = { id: string; name: string; email: string | null; role: string | null };

export function MobileUpdatesView({
  projectId,
  updates,
  taggableItems,
  contacts,
  contractItems,
  highlightUpdateId,
  initialQuery,
  initialFrom,
  initialTo,
  initialCategory
}: {
  projectId: string;
  updates: UpdateWithReplies[];
  taggableItems: VariationItem[];
  contacts: ContactOption[];
  contractItems: TaggableContractItem[];
  highlightUpdateId?: string;
  initialQuery: string;
  initialFrom: string;
  initialTo: string;
  initialCategory: string;
}) {
  const openItems = taggableItems.filter((item) => item.status !== "complete");
  const isFiltered = Boolean(initialQuery || initialFrom || initialTo || initialCategory);

  useEffect(() => {
    if (!highlightUpdateId) return;
    const el = document.getElementById(`update-${highlightUpdateId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-primary");
    const timeout = setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 2500);
    return () => clearTimeout(timeout);
  }, [highlightUpdateId]);

  return (
    <div className="flex flex-col gap-4">
      <UpdateComposer projectId={projectId} taggableItems={taggableItems} contacts={contacts} variant="mobile" />

      {taggableItems.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {taggableItems.map((item) => {
            const urgency = item.status !== "complete" && item.dueAt ? getCountdownInfo(item.dueAt).urgency : null;
            const urgentStyle =
              urgency === "overdue"
                ? "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                : urgency === "today" || urgency === "soon"
                  ? "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                  : item.status === "complete"
                    ? "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400";

            return (
              <span
                key={item.id}
                className={`shrink-0 inline-flex items-center px-2 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${urgentStyle}`}
              >
                {item.reference}
                {(urgency === "overdue" || urgency === "today" || urgency === "soon") &&
                  item.dueAt &&
                  ` · ${getCountdownInfo(item.dueAt).label}`}
              </span>
            );
          })}
        </div>
      )}

      <UpdatesSearchBar
        basePath={`/m/${projectId}`}
        initialQuery={initialQuery}
        initialFrom={initialFrom}
        initialTo={initialTo}
        initialCategory={initialCategory}
      />

      {updates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#e7edf3] dark:border-slate-700 py-12">
          <p className="font-bold mb-1 text-sm">{isFiltered ? "No matching diary entries" : "No diary entries yet"}</p>
          <p className="text-xs text-[#4c739a] dark:text-slate-400">
            {isFiltered ? "Try a different keyword, date range, or Variation/SI reference." : "Post the first diary entry above."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {updates.map((update) => (
            <MobileThread key={update.id} projectId={projectId} update={update} taggableItems={taggableItems} contractItems={contractItems} />
          ))}
        </div>
      )}
    </div>
  );
}
