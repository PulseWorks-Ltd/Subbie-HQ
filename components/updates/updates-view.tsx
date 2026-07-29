"use client";

import type { Update, UpdateAttachment, VariationItem } from "@prisma/client";
import { UpdateThread } from "@/components/updates/update-thread";
import { UpdateComposer } from "@/components/updates/update-composer";

type Author = { id: string; name: string | null; email: string };
type VariationItemRef = { id: string; reference: string; title: string };
type UpdateWithReplies = Update & {
  author: Author;
  variationItem: VariationItemRef | null;
  attachments: UpdateAttachment[];
  replies: (Update & { author: Author; attachments: UpdateAttachment[] })[];
};
type ContactOption = { id: string; name: string; email: string | null; role: string | null };

export function UpdatesView({
  projectId,
  updates,
  taggableItems,
  contacts
}: {
  projectId: string;
  updates: UpdateWithReplies[];
  taggableItems: VariationItem[];
  contacts: ContactOption[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-bold">Updates</h2>
        <p className="text-sm text-[#4c739a] dark:text-slate-400">
          A running, audit-friendly log of what's happening on this project.
        </p>
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-4">
        <UpdateComposer projectId={projectId} taggableItems={taggableItems} contacts={contacts} variant="desktop" />

        {updates.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#cfdbe7] dark:border-slate-700 py-16">
            <p className="font-bold mb-1">No updates yet</p>
            <p className="text-sm text-[#4c739a] dark:text-slate-400">
              Post the first update to start the project's communication trail.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {updates.map((update) => (
              <UpdateThread key={update.id} projectId={projectId} update={update} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
