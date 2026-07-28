import type { Update, UpdateAttachment } from "@prisma/client";
import { UpdateThread } from "@/components/updates/update-thread";

type Author = { id: string; name: string | null; email: string };
type VariationItemRef = { id: string; reference: string; title: string };
type UpdateWithReplies = Update & {
  author: Author;
  variationItem: VariationItemRef | null;
  attachments: UpdateAttachment[];
  replies: (Update & { author: Author; attachments: UpdateAttachment[] })[];
};

export function VariationLinkedUpdatesSection({
  projectId,
  updates
}: {
  projectId: string;
  updates: UpdateWithReplies[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-bold">Linked Updates</h3>
      {updates.length === 0 ? (
        <p className="text-sm text-[#4c739a] dark:text-slate-400">No updates tagged to this item yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {updates.map((update) => (
            <UpdateThread key={update.id} projectId={projectId} update={update} />
          ))}
        </div>
      )}
    </div>
  );
}
