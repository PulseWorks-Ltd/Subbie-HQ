"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Update, UpdateAttachment, VariationItem } from "@prisma/client";
import { AttachmentThumbnails } from "@/components/attachment-thumbnails";
import { AttachmentPreviewList } from "@/components/updates/attachment-preview-list";
import { GenerateOutboundEmailPanel } from "@/components/updates/generate-outbound-email-panel";
import { formatUserName } from "@/lib/user-display";
import { ATTACHMENT_ACCEPT, MAX_ATTACHMENTS, MAX_ATTACHMENT_SIZE_BYTES, isAllowedAttachmentType } from "@/lib/update-attachments";

type Author = { id: string; firstName: string | null; lastName: string | null; email: string };
type VariationItemRef = { id: string; reference: string; title: string };
type ContactOption = { id: string; name: string; email: string | null; role: string | null };
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
  return formatUserName(author) ?? author.email;
}

export function UpdateThread({
  projectId,
  update,
  contacts,
  taggableItems,
  defaultRatePerHour
}: {
  projectId: string;
  update: UpdateWithReplies;
  contacts: ContactOption[];
  taggableItems: VariationItem[];
  defaultRatePerHour: string;
}) {
  const router = useRouter();
  const [isReplying, setIsReplying] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [replyFileError, setReplyFileError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Same validate-then-add/remove pattern as UpdateComposer (Task 2.1) —
  // rejects an invalid selection with a message rather than silently
  // dropping it or letting the server reject it after a full upload.
  function addReplyFiles(selected: FileList | null) {
    if (!selected || selected.length === 0) return;
    setReplyFileError(null);
    const incoming = Array.from(selected);

    const invalidType = incoming.find((file) => !isAllowedAttachmentType(file.type));
    if (invalidType) {
      setReplyFileError(`"${invalidType.name}" isn't a supported file type. Attach images, PDFs, or DOCX files.`);
      return;
    }
    const tooLarge = incoming.find((file) => file.size > MAX_ATTACHMENT_SIZE_BYTES);
    if (tooLarge) {
      setReplyFileError(`"${tooLarge.name}" is over the ${MAX_ATTACHMENT_SIZE_BYTES / (1024 * 1024)}MB limit per attachment.`);
      return;
    }

    setReplyFiles((current) => {
      const combined = [...current, ...incoming];
      if (combined.length > MAX_ATTACHMENTS) {
        setReplyFileError(`You can attach up to ${MAX_ATTACHMENTS} files per update.`);
        return current;
      }
      return combined;
    });
  }

  function removeReplyFile(index: number) {
    setReplyFiles((current) => current.filter((_, i) => i !== index));
  }
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [isEditingTag, setIsEditingTag] = useState(false);
  const [tagSelection, setTagSelection] = useState(update.variationItem?.id ?? "");
  const [isSavingTag, setIsSavingTag] = useState(false);

  async function handleSaveTag() {
    setIsSavingTag(true);
    await fetch(`/api/projects/${projectId}/updates/${update.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variationItemId: tagSelection || null })
    });
    setIsSavingTag(false);
    setIsEditingTag(false);
    router.refresh();
  }

  async function handleRemoveTag() {
    if (!update.variationItem) return;
    if (!confirm(`Remove this Update's tag from ${update.variationItem.reference}? The Update itself will remain on the Updates page.`)) {
      return;
    }
    setIsSavingTag(true);
    await fetch(`/api/projects/${projectId}/updates/${update.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variationItemId: null })
    });
    setIsSavingTag(false);
    router.refresh();
  }

  // Every attachment across the whole thread (the top-level update plus
  // every reply, any file type) so the outbound-email panel can offer
  // them all for selection — not just the ones on the most recent entry.
  const attachmentOptions = [
    ...update.attachments.map((attachment) => ({
      id: attachment.id,
      fileName: attachment.fileName,
      authorLabel: authorLabel(update.author)
    })),
    ...update.replies.flatMap((reply) =>
      reply.attachments.map((attachment) => ({
        id: attachment.id,
        fileName: attachment.fileName,
        authorLabel: authorLabel(reply.author)
      }))
    )
  ];

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
    setReplyFileError(null);
    setIsReplying(false);
    router.refresh();
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#cfdbe7] dark:border-slate-800 p-5">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-bold">{authorLabel(update.author)}</p>
          {isEditingTag ? (
            <>
              <select
                value={tagSelection}
                onChange={(event) => setTagSelection(event.target.value)}
                className="h-7 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">Not tied to a Variation/SI</option>
                {taggableItems.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.reference} · {option.title}
                  </option>
                ))}
              </select>
              <button
                onClick={handleSaveTag}
                disabled={isSavingTag}
                className="text-[11px] font-bold text-primary hover:underline disabled:opacity-60"
              >
                {isSavingTag ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => {
                  setTagSelection(update.variationItem?.id ?? "");
                  setIsEditingTag(false);
                }}
                className="text-[11px] font-medium text-[#4c739a] dark:text-slate-400 hover:underline"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              {update.variationItem && (
                <Link
                  href={`/projects/${projectId}/variations/${update.variationItem.id}`}
                  className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-primary/10 text-primary hover:bg-primary/20"
                >
                  {update.variationItem.reference}
                </Link>
              )}
              {update.percentComplete != null && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  {Math.round(update.percentComplete)}% tagged
                </span>
              )}
              <button
                onClick={() => setIsEditingTag(true)}
                className="text-[11px] font-medium text-[#4c739a] dark:text-slate-400 hover:text-primary hover:underline"
              >
                {update.variationItem ? "Change tag" : "+ Tag"}
              </button>
              {update.variationItem && (
                <button
                  onClick={handleRemoveTag}
                  disabled={isSavingTag}
                  className="text-[11px] font-medium text-red-600 hover:underline disabled:opacity-60"
                >
                  Remove tag
                </button>
              )}
            </>
          )}
        </div>
        <p className="text-xs text-[#4c739a] dark:text-slate-400 shrink-0">{formatTimestamp(update.createdAt)}</p>
      </div>
      <p className="text-sm text-[#0d141b] dark:text-slate-200 leading-relaxed whitespace-pre-wrap mb-1">
        {update.body}
      </p>
      <AttachmentThumbnails
        projectId={projectId}
        attachments={update.attachments}
        taggableItems={taggableItems}
        defaultVariationItemId={update.variationItem?.id ?? null}
        defaultRatePerHour={defaultRatePerHour}
      />

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
              <AttachmentThumbnails
                projectId={projectId}
                attachments={reply.attachments}
                taggableItems={taggableItems}
                defaultVariationItemId={update.variationItem?.id ?? null}
                defaultRatePerHour={defaultRatePerHour}
              />
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
            <label className="flex items-center gap-2 text-xs font-medium text-[#4c739a] dark:text-slate-400 cursor-pointer">
              <span className="material-symbols-outlined text-base">attach_file</span>
              {replyFiles.length > 0
                ? `${replyFiles.length} file${replyFiles.length > 1 ? "s" : ""} attached`
                : "Attach photos, PDFs, or DOCX"}
              <input
                type="file"
                accept={ATTACHMENT_ACCEPT}
                multiple
                onChange={(event) => {
                  addReplyFiles(event.target.files);
                  event.target.value = "";
                }}
                className="hidden"
              />
            </label>
            <AttachmentPreviewList files={replyFiles} onRemove={removeReplyFile} />
            {replyFileError && <p className="text-xs text-red-600 dark:text-red-400">{replyFileError}</p>}
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
        ) : isGeneratingEmail ? (
          <GenerateOutboundEmailPanel
            projectId={projectId}
            updateId={update.id}
            contacts={contacts}
            attachmentOptions={attachmentOptions}
            onCancel={() => setIsGeneratingEmail(false)}
            onSent={() => {
              setIsGeneratingEmail(false);
              setSentMessage("Outbound email sent and logged to Correspondence.");
            }}
          />
        ) : (
          <div className="flex items-center gap-4">
            <button onClick={() => setIsReplying(true)} className="text-xs font-bold text-primary hover:underline">
              Reply
            </button>
            <button
              onClick={() => {
                setSentMessage(null);
                setIsGeneratingEmail(true);
              }}
              className="text-xs font-bold text-primary hover:underline"
            >
              Generate outbound email
            </button>
          </div>
        )}
        {sentMessage && <p className="text-xs text-green-600 dark:text-green-400 mt-2">{sentMessage}</p>}
      </div>
    </div>
  );
}
