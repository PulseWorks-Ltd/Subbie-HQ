type AttachmentRef = { id: string; fileName: string };

export function AttachmentThumbnails({
  projectId,
  attachments
}: {
  projectId: string;
  attachments: AttachmentRef[];
}) {
  if (attachments.length === 0) return null;

  return (
    <div className="flex gap-2 flex-wrap mt-2 mb-1">
      {attachments.map((attachment) => {
        const href = `/api/projects/${projectId}/attachments/${attachment.id}/file`;
        return (
          <a key={attachment.id} href={href} target="_blank" rel="noreferrer" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={href}
              alt={attachment.fileName}
              className="size-16 rounded-lg object-cover border border-[#e7edf3] dark:border-slate-800"
            />
          </a>
        );
      })}
    </div>
  );
}
