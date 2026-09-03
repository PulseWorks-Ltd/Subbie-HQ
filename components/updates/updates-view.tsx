"use client";

import type { Update, UpdateAttachment, VariationItem } from "@prisma/client";
import type { TaggableContractItem } from "@/lib/contract-schedule";
import { UpdateThread } from "@/components/updates/update-thread";
import { UpdateComposer } from "@/components/updates/update-composer";
import { UpdatesSearchBar } from "@/components/updates/updates-search-bar";

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

export function UpdatesView({
  projectId,
  updates,
  taggableItems,
  contacts,
  defaultRatePerHour,
  contractItems,
  initialQuery,
  initialFrom,
  initialTo,
  initialCategory
}: {
  projectId: string;
  updates: UpdateWithReplies[];
  taggableItems: VariationItem[];
  contacts: ContactOption[];
  defaultRatePerHour: string;
  contractItems: TaggableContractItem[];
  initialQuery: string;
  initialFrom: string;
  initialTo: string;
  initialCategory: string;
}) {
  const isFiltered = Boolean(initialQuery || initialFrom || initialTo || initialCategory);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-bold">Project Diary</h2>
        <p className="text-sm text-[#4c739a] dark:text-slate-400">
          A running, audit-friendly log of what's happening on this project.
        </p>
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-4">
        <UpdateComposer projectId={projectId} taggableItems={taggableItems} contacts={contacts} variant="desktop" />

        <UpdatesSearchBar
          basePath={`/projects/${projectId}/updates`}
          initialQuery={initialQuery}
          initialFrom={initialFrom}
          initialTo={initialTo}
          initialCategory={initialCategory}
        />

        {updates.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#cfdbe7] dark:border-slate-700 py-16">
            <p className="font-bold mb-1">{isFiltered ? "No matching diary entries" : "No diary entries yet"}</p>
            <p className="text-sm text-[#4c739a] dark:text-slate-400">
              {isFiltered
                ? "Try a different keyword, date range, or Variation/SI reference."
                : "Post the first diary entry to start the project's communication trail."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {updates.map((update) => (
              <UpdateThread
                key={update.id}
                projectId={projectId}
                update={update}
                contacts={contacts}
                taggableItems={taggableItems}
                defaultRatePerHour={defaultRatePerHour}
                contractItems={contractItems}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
