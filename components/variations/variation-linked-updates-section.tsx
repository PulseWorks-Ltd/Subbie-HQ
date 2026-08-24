import type { Update, UpdateAttachment, VariationItem } from "@prisma/client";
import { UpdateThread } from "@/components/updates/update-thread";

type Author = { id: string; firstName: string | null; lastName: string | null; email: string };
type VariationItemRef = { id: string; reference: string; title: string };
type ContactOption = { id: string; name: string; email: string | null; role: string | null };
type UpdateWithReplies = Update & {
  author: Author;
  variationItem: VariationItemRef | null;
  qaRecord: { id: string; stage: string } | null;
  attachments: UpdateAttachment[];
  replies: (Update & { author: Author; attachments: UpdateAttachment[] })[];
};

export function VariationLinkedUpdatesSection({
  projectId,
  updates,
  contacts,
  taggableItems,
  defaultRatePerHour
}: {
  projectId: string;
  updates: UpdateWithReplies[];
  contacts: ContactOption[];
  taggableItems: VariationItem[];
  defaultRatePerHour: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-bold">Linked Updates</h3>
      {updates.length === 0 ? (
        <p className="text-sm text-[#4c739a] dark:text-slate-400">No updates tagged to this item yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {updates.map((update) => (
            <UpdateThread
              key={update.id}
              projectId={projectId}
              update={update}
              contacts={contacts}
              taggableItems={taggableItems}
              defaultRatePerHour={defaultRatePerHour}
            />
          ))}
        </div>
      )}
    </div>
  );
}
