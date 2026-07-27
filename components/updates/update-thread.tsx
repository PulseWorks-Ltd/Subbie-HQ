"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Update, UpdateAttachment } from "@prisma/client";
import { AttachmentThumbnails } from "@/components/attachment-thumbnails";

type Author = { id: string; name: string | null; email: string };
type SiteInstructionRef = { id: string; reference: string; title: string };
type UpdateWithReplies = Update & {
  author: Author;
  siteInstruction: SiteInstructionRef | null;
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

export function UpdateThread({ projectId, update }: { projectId: string; update: UpdateWithReplies }) {
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
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#cfdbe7] dark:border-slate-800 p-5">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold">{authorLabel(update.author)}</p>
          {update.siteInstruction && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-primary/10 text-primary">
              {update.siteInstruction.reference}
            </span>
          )}
        </div>
        <p className="text-xs text-[#4c739a] dark:text-slate-400 shrink-0">{formatTimestamp(update.createdAt)}</p>
      </div>
      <p className="text-sm text-[#0d141b] dark:text-slate-200 leading-relaxed whitespace-pre-wrap mb-1">
        {update.body}
      </p>
      <AttachmentThumbnails projectId={projectId} attachments={update.attachments} />

      {update.replies.length > 0 && (
        <div className="flex flex-col gap-3 mt-4 pl-4 border-l-2 border-[#e7edf3] dark:border-slate-800">
          {update.replies.map((reply) => (
            <div key={reply.id}>
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <p className="text-xs font-bold">{authorLabel(reply.author)}</p>
                <p className="text-[11px] text-[#4c739a] dark:text-slate-400 shrink-0">
                  {formatTimestamp(reply.createdAt)}
                </p>
              </div>
              <p className="text-sm text-[#0d141b] dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                {reply.body}
              </p>
              <AttachmentThumbnails projectId={projectId} attachments={reply.attachments} />
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-[#e7edf3] dark:border-slate-800">
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
              {replyFiles.length > 0 ? `${replyFiles.length} photo${replyFiles.length > 1 ? "s" : ""} attached` : "Attach photos"}
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => setReplyFiles(Array.from(event.target.files ?? []))}
                className="hidden"
              />
            </label>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setIsReplying(false)}
                className="h-8 px-3 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="h-8 px-3 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 disabled:opacity-60"
              >
                {isSubmitting ? "Posting..." : "Post reply"}
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setIsReplying(true)}
            className="text-xs font-bold text-primary hover:underline"
          >
            Reply
          </button>
        )}
      </div>
    </div>
  );
}
