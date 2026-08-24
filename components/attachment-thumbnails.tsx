import { UseAsDayWorksSheetAction, type TaggableItem } from "@/components/day-works/use-as-day-works-sheet-action";
import { UseAsQaRecordAction } from "@/components/quality-assurance/use-as-qa-record-action";
import { attachmentKind, canUseAsDayWorksSheet, canUseAsQaRecord } from "@/lib/update-attachments";

type AttachmentRef = { id: string; fileName: string; contentType: string };

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
  // Works Sheet" per attachment (Task 1.1a). Omitted entirely elsewhere (e.g.
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
        const kind = attachmentKind(attachment.contentType);
        return (
          <div key={attachment.id} className="relative">
            <a href={href} target="_blank" rel="noreferrer" className="block">
              {kind === "image" ? (
                // Stored derivative (~800px, generated at upload time — see
                // lib/image-thumbnails.ts), not the full original — the
                // click-through above still opens the full-quality original
                // untouched (Task 2.3). Falls back to the original itself
                // for any attachment uploaded before this feature existed
                // (thumbnailStorageKey null — the file route serves the
                // original when no derivative is on file).
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`${href}?variant=thumbnail`}
                  alt={attachment.fileName}
                  className="size-16 rounded-lg object-cover border border-[#e7edf3] dark:border-slate-800"
                />
              ) : (
                <div className="size-16 rounded-lg border border-[#e7edf3] dark:border-slate-800 bg-[#f6f7f8] dark:bg-slate-800 flex flex-col items-center justify-center gap-0.5 p-1">
                  <span className="material-symbols-outlined text-lg text-[#4c739a] dark:text-slate-400">
                    {kind === "pdf" ? "picture_as_pdf" : "description"}
                  </span>
                  <span className="text-[8px] leading-tight text-center text-[#4c739a] dark:text-slate-400 truncate w-full">
                    {attachment.fileName}
                  </span>
                </div>
              )}
            </a>
            {taggableItems &&
              (canUseAsDayWorksSheet(attachment.contentType) || canUseAsQaRecord(attachment.contentType)) && (
                <div className="absolute -bottom-1 -right-1 flex gap-1">
                  {canUseAsDayWorksSheet(attachment.contentType) && (
                    <div className="size-6 flex items-center justify-center rounded-full bg-white dark:bg-slate-900 border border-[#e7edf3] dark:border-slate-700 shadow-sm">
                      <UseAsDayWorksSheetAction
                        projectId={projectId}
                        source={{ type: "update-attachment", id: attachment.id }}
                        taggableItems={taggableItems}
                        defaultVariationItemId={defaultVariationItemId ?? null}
                        defaultRatePerHour={defaultRatePerHour ?? ""}
                      />
                    </div>
                  )}
                  {canUseAsQaRecord(attachment.contentType) && (
                    <div className="size-6 flex items-center justify-center rounded-full bg-white dark:bg-slate-900 border border-[#e7edf3] dark:border-slate-700 shadow-sm">
                      <UseAsQaRecordAction
                        projectId={projectId}
                        source={{ type: "update-attachment", id: attachment.id }}
                        taggableItems={taggableItems}
                        defaultVariationItemId={defaultVariationItemId ?? null}
                      />
                    </div>
                  )}
                </div>
              )}
          </div>
        );
      })}
    </div>
  );
}
