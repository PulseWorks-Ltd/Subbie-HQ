"use client";

import { useEffect, useState } from "react";
import { attachmentKind } from "@/lib/update-attachments";

// Local-only preview of files selected but not yet posted (Task 2.1/2.2) —
// image thumbnails via an object URL, a file icon + filename for PDF/DOCX
// (no inline preview needed for those, per this feature's scope), and a
// remove button per item so a mis-selected file doesn't force starting
// the whole attachment selection over.
export function AttachmentPreviewList({ files, onRemove }: { files: File[]; onRemove: (index: number) => void }) {
  const [imageUrls, setImageUrls] = useState<Map<File, string>>(new Map());

  // Object URLs are only ever created for image files, and only once per
  // File object (not re-created every render) — revoked on unmount or
  // whenever a file leaves the list, so removing/replacing attachments
  // across a long compose session doesn't leak blob URLs.
  useEffect(() => {
    setImageUrls((current) => {
      const next = new Map<File, string>();
      for (const file of files) {
        if (attachmentKind(file.type) !== "image") continue;
        next.set(file, current.get(file) ?? URL.createObjectURL(file));
      }
      for (const [file, url] of current) {
        if (!next.has(file)) URL.revokeObjectURL(url);
      }
      return next;
    });
  }, [files]);

  useEffect(() => {
    return () => {
      setImageUrls((current) => {
        for (const url of current.values()) URL.revokeObjectURL(url);
        return current;
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (files.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {files.map((file, index) => {
        const kind = attachmentKind(file.type);
        const imageUrl = imageUrls.get(file);
        return (
          <div key={`${file.name}-${index}`} className="relative">
            {kind === "image" && imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt={file.name}
                className="size-16 rounded-lg object-cover border border-[#e7edf3] dark:border-slate-700"
              />
            ) : (
              <div className="size-16 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-[#f6f7f8] dark:bg-slate-800 flex flex-col items-center justify-center gap-0.5 p-1">
                <span className="material-symbols-outlined text-lg text-[#4c739a] dark:text-slate-400">
                  {kind === "pdf" ? "picture_as_pdf" : "description"}
                </span>
                <span className="text-[8px] leading-tight text-center text-[#4c739a] dark:text-slate-400 truncate w-full">
                  {file.name}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => onRemove(index)}
              aria-label={`Remove ${file.name}`}
              className="absolute -top-1.5 -right-1.5 size-5 flex items-center justify-center rounded-full bg-white dark:bg-slate-900 border border-[#e7edf3] dark:border-slate-700 shadow-sm text-[#4c739a] dark:text-slate-400 hover:text-red-600"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
