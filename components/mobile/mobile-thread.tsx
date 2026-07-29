"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Update, UpdateAttachment } from "@prisma/client";
import { AttachmentThumbnails } from "@/components/attachment-thumbnails";

type Author = { id: string; name: string | null; email: string };
type VariationItemRef = { id: string; reference: string; title: string };
type UpdateWithReplies = Update & {
  author: Author;
  variationItem: VariationItemRef | null;
  attachments: UpdateAttachment[];
  replies: (Update & { author: Author; attachments: UpdateAttachment[] })[];
};

function formatTimestamp(date: Date) {
  return new Date(date).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function authorLabel(author: Author) {
  return author.name ?? author.email;
}

export function MobileThread({ projectId, update }: { projectId: string; update: UpdateWithReplies }) {
  const router = useRouter();
  const [isReplying, setIsReplying] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleReply(event: React.FormEvent) {
    event.preventDefault();
    if (!replyBody.trim()) return;
    setIsSubmitting(true);

    const formData = new FormData();
    formData.set("body", replyBody);
    formData.set("parentId", update.id);
    replyFiles.forEach((file) => formData.append("files", file));

    await fetch(`/api/projects/${projectId}/updates`, { method: "POST", body: formData });

    setIsSubmitting(false);
    setReplyBody("");
    setReplyFiles([]);
    setIsReplying(false);
    router.refresh();
  }

  return (
    <div id={`update-${update.id}`} className="bg-white dark:bg-slate-900 rounded-xl border border-[#e7edf3] dark:border-slate-800 p-4 scroll-mt-20 transition-shadow">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <p className="text-sm font-bold">{authorLabel(update.author)}</p>
        <p className="text-[11px] text-[#4c739a] dark:text-slate-400 shrink-0">{formatTimestamp(update.createdAt)}</p>
      </div>
      {update.variationItem && (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-primary/10 text-primary mb-1">
          {update.variationItem.reference}
        </span>
      )}
      <p className="text-sm leading-relaxed whitespace-pre-wrap mb-1">{update.body}</p>
      <AttachmentThumbnails projectId={projectId} attachments={update.attachments} />

      {update.replies.length > 0 && (
        <div className="flex flex-col gap-2 mt-3 pl-3 border-l-2 border-[#e7edf3] dark:border-slate-800">
          {update.replies.map((reply) => (
            <div key={reply.id} id={`update-${reply.id}`} className="scroll-mt-20">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs font-bold">{authorLabel(reply.author)}</p>
                <p className="text-[10px] text-[#4c739a] dark:text-slate-400">{formatTimestamp(reply.createdAt)}</p>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{reply.body}</p>
              <AttachmentThumbnails projectId={projectId} attachments={reply.attachments} />
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 pt-2 border-t border-[#e7edf3] dark:border-slate-800">
        {isReplying ? (
          <form onSubmit={handleReply} className="flex flex-col gap-2">
            <textarea
              autoFocus
              value={replyBody}
              onChange={(event) => setReplyBody(event.target.value)}
              rows={2}
              placeholder="Write a reply..."
              className="rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <label className="flex items-center gap-2 text-xs font-medium text-[#4c739a] dark:text-slate-400">
              <span className="material-symbols-outlined text-base">photo_camera</span>
              {replyFiles.length > 0 ? `${replyFiles.length} photo${replyFiles.length > 1 ? "s" : ""} attached` : "Add photo"}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={(event) => setReplyFiles(Array.from(event.target.files ?? []))}
                className="hidden"
              />
            </label>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setIsReplying(false)}
                className="h-9 px-3 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="h-9 px-4 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 disabled:opacity-60"
              >
                {isSubmitting ? "Posting..." : "Post reply"}
              </button>
            </div>
          </form>
        ) : (
          <button onClick={() => setIsReplying(true)} className="text-xs font-bold text-primary">
            Reply
          </button>
        )}
      </div>
    </div>
  );
}
