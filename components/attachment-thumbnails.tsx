import { UseAsDayWorksSheetAction, type TaggableItem } from "@/components/day-works/use-as-day-works-sheet-action";

type AttachmentRef = { id: string; fileName: string };

export function AttachmentThumbnails({
  projectId,
  attachments,
  taggableItems,
  defaultVariationItemId,
  defaultRatePerHour
}: {
  projectId: string;
  attachments: AttachmentRef[];
  // Optional: only Update-thread callers pass these, to offer "Use as Day
  // Works Sheet" per photo (Task 1.1a). Omitted entirely elsewhere (e.g.
  // any other reuse of this component) just hides that action.
  taggableItems?: TaggableItem[];
  defaultVariationItemId?: string | null;
  defaultRatePerHour?: string;
}) {
  if (attachments.length === 0) return null;

  return (
    <div className="flex gap-2 flex-wrap mt-2 mb-1">
      {attachments.map((attachment) => {
        const href = `/api/projects/${projectId}/attachments/${attachment.id}/file`;
        return (
          <div key={attachment.id} className="relative">
            <a href={href} target="_blank" rel="noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={href}
                alt={attachment.fileName}
                className="size-16 rounded-lg object-cover border border-[#e7edf3] dark:border-slate-800"
              />
            </a>
            {taggableItems && (
              <div className="absolute -bottom-1 -right-1 size-6 flex items-center justify-center rounded-full bg-white dark:bg-slate-900 border border-[#e7edf3] dark:border-slate-700 shadow-sm">
                <UseAsDayWorksSheetAction
                  projectId={projectId}
                  source={{ type: "update-attachment", id: attachment.id }}
                  taggableItems={taggableItems}
                  defaultVariationItemId={defaultVariationItemId ?? null}
                  defaultRatePerHour={defaultRatePerHour ?? ""}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
