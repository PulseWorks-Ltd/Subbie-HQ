"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Update, UpdateAttachment, VariationItem } from "@prisma/client";
import { AttachmentThumbnails } from "@/components/attachment-thumbnails";
import { AttachmentPreviewList } from "@/components/updates/attachment-preview-list";
import { AssignUpdateAsQaDialog } from "@/components/quality-assurance/assign-update-as-qa-dialog";
import { AssignUpdateAsContractProgressDialog } from "@/components/contract-schedule/assign-update-as-contract-progress-dialog";
import { ContractItemMultiSelect } from "@/components/contract-schedule/contract-item-multi-select";
import { CategoryCascadeFields, SI_FREE_TEXT_SENTINEL } from "@/components/updates/category-cascade-fields";
import { type TaggableContractItem, getContractItemDisplayLabel } from "@/lib/contract-schedule";
import { formatUserName } from "@/lib/user-display";
import { ATTACHMENT_ACCEPT, MAX_ATTACHMENTS, MAX_ATTACHMENT_SIZE_BYTES, isAllowedAttachmentType } from "@/lib/update-attachments";
import { ASSIGN_QA_SENTINEL } from "@/lib/qa-tag";
import { UPDATE_CATEGORY_LABELS, categoryOptionValue, parseCategoryOptionValue } from "@/lib/update-category";

type Author = { id: string; firstName: string | null; lastName: string | null; email: string };
type VariationItemRef = { id: string; reference: string; title: string };
type QaRecordRef = { id: string; stage: string };
type UpdateWithReplies = Update & {
  author: Author;
  variationItem: VariationItemRef | null;
  qaRecord: QaRecordRef | null;
  attachments: UpdateAttachment[];
  contractItemLinks: { contractItemId: string }[];
  replies: (Update & { author: Author; attachments: UpdateAttachment[] })[];
};

// See desktop UpdateThread's identical helpers for why a tagged real item
// now shows as "Variation" at the primary level (Pre-Launch category
// restructure removed the old flat "Site Instructions / Variations" optgroup).
function currentTagSelection(update: { variationItem: VariationItemRef | null; qaRecord: QaRecordRef | null; category: string | null }) {
  if (update.category) return categoryOptionValue(update.category as Parameters<typeof categoryOptionValue>[0]);
  if (update.qaRecord) return ASSIGN_QA_SENTINEL;
  if (update.variationItem) return categoryOptionValue("variation");
  return "";
}

function currentVariationSecondary(update: { variationItem: VariationItemRef | null; freeTextSiteInstructionReference: string | null }) {
  if (update.variationItem) return update.variationItem.id;
  if (update.freeTextSiteInstructionReference) return SI_FREE_TEXT_SENTINEL;
  return "";
}

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

export function MobileThread({
  projectId,
  update,
  taggableItems,
  contractItems
}: {
  projectId: string;
  update: UpdateWithReplies;
  taggableItems: VariationItem[];
  contractItems: TaggableContractItem[];
}) {
  const router = useRouter();
  const [isReplying, setIsReplying] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [replyFileError, setReplyFileError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Same validate-then-add/remove pattern as UpdateComposer (Task 2.2) —
  // two separate <input> elements (camera capture, document picker) both
  // feed this same list, adding to whatever's already picked rather than
  // replacing it.
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
  const [isEditingTag, setIsEditingTag] = useState(false);
  const [tagSelection, setTagSelection] = useState(currentTagSelection(update));
  const [variationSecondary, setVariationSecondary] = useState(currentVariationSecondary(update));
  const [freeTextSI, setFreeTextSI] = useState(update.freeTextSiteInstructionReference ?? "");
  const [contractItemIds, setContractItemIds] = useState<string[]>(update.contractItemLinks.map((link) => link.contractItemId));
  const [isSavingTag, setIsSavingTag] = useState(false);
  const [showAssignQaDialog, setShowAssignQaDialog] = useState(false);
  const [showContractProgressDialog, setShowContractProgressDialog] = useState(false);

  const linkedContractItems = contractItems.filter((item) =>
    update.contractItemLinks.some((link) => link.contractItemId === item.id)
  );

  // Same PATCH endpoint and tag semantics as desktop's UpdateThread (Task
  // 2.1) — "which SI/Variation this belongs to" often only becomes clear
  // after the update's already posted, so this needs to be editable after
  // the fact, not just at compose time. "Assign QA" (see the shared
  // AssignUpdateAsQaDialog) is the one option that doesn't PATCH directly —
  // it opens a dialog instead, since creating a QARecord needs a stage
  // label first.
  async function handleSaveTag() {
    if (tagSelection === ASSIGN_QA_SENTINEL) {
      if (update.qaRecord) {
        setIsEditingTag(false);
        return;
      }
      setIsEditingTag(false);
      setShowAssignQaDialog(true);
      return;
    }
    const selectedCategory = parseCategoryOptionValue(tagSelection);
    let body: Record<string, unknown>;
    if (selectedCategory === "variation" && variationSecondary && variationSecondary !== SI_FREE_TEXT_SENTINEL) {
      body = { variationItemId: variationSecondary };
    } else if (selectedCategory === "variation" && variationSecondary === SI_FREE_TEXT_SENTINEL) {
      body = { category: "variation", freeTextSiteInstructionReference: freeTextSI.trim() || null };
    } else if (selectedCategory) {
      body = { category: selectedCategory };
    } else {
      body = { category: null };
    }
    body.contractItemIds = contractItemIds;

    setIsSavingTag(true);
    await fetch(`/api/projects/${projectId}/updates/${update.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    setIsSavingTag(false);
    setIsEditingTag(false);
    router.refresh();
  }

  async function handleRemoveTag() {
    const label =
      update.variationItem?.reference ??
      (update.qaRecord ? `QA — ${update.qaRecord.stage}` : update.category ? UPDATE_CATEGORY_LABELS[update.category] : null);
    if (!label) return;
    if (!confirm(`Remove this diary entry's tag from ${label}? The diary entry itself will remain on the Project Diary page.`)) {
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
    <div id={`update-${update.id}`} className="bg-white dark:bg-slate-900 rounded-xl border border-[#e7edf3] dark:border-slate-800 p-4 scroll-mt-20 transition-shadow">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <p className="text-sm font-bold">{authorLabel(update.author)}</p>
        <p className="text-[11px] text-[#4c739a] dark:text-slate-400 shrink-0">{formatTimestamp(update.createdAt)}</p>
      </div>

      {isEditingTag ? (
        <div className="flex flex-col gap-2 mb-1.5">
          <div className="flex items-start gap-2 flex-wrap">
            <CategoryCascadeFields
              primary={tagSelection}
              onPrimaryChange={(value) => {
                setTagSelection(value);
                setVariationSecondary("");
                setFreeTextSI("");
              }}
              currentCategory={update.category as Parameters<typeof categoryOptionValue>[0] | null}
              taggableItems={taggableItems}
              variationSecondary={variationSecondary}
              onVariationSecondaryChange={setVariationSecondary}
              freeText={freeTextSI}
              onFreeTextChange={setFreeTextSI}
            />
            <button
              onClick={handleSaveTag}
              disabled={isSavingTag}
              className="text-[11px] font-bold text-primary hover:underline disabled:opacity-60"
            >
              {isSavingTag ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => {
                setTagSelection(currentTagSelection(update));
                setVariationSecondary(currentVariationSecondary(update));
                setFreeTextSI(update.freeTextSiteInstructionReference ?? "");
                setContractItemIds(update.contractItemLinks.map((link) => link.contractItemId));
                setIsEditingTag(false);
              }}
              className="text-[11px] font-medium text-[#4c739a] dark:text-slate-400 hover:underline"
            >
              Cancel
            </button>
          </div>
          <ContractItemMultiSelect items={contractItems} selectedIds={contractItemIds} onChange={setContractItemIds} />
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          {update.variationItem && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-primary/10 text-primary">
              {update.variationItem.reference}
            </span>
          )}
          {update.qaRecord && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-primary/10 text-primary">
              QA · {update.qaRecord.stage}
            </span>
          )}
          {update.category && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              {UPDATE_CATEGORY_LABELS[update.category]}
              {update.freeTextSiteInstructionReference ? ` · ${update.freeTextSiteInstructionReference}` : ""}
            </span>
          )}
          {linkedContractItems.map((item) => (
            <span
              key={item.id}
              className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
            >
              {getContractItemDisplayLabel(item)}
            </span>
          ))}
          <button
            onClick={() => setIsEditingTag(true)}
            className="text-[11px] font-medium text-[#4c739a] dark:text-slate-400 hover:text-primary hover:underline"
          >
            {update.variationItem || update.qaRecord || update.category ? "Change tag" : "+ Tag"}
          </button>
          {(update.variationItem || update.qaRecord || update.category) && (
            <button
              onClick={handleRemoveTag}
              disabled={isSavingTag}
              className="text-[11px] font-medium text-red-600 hover:underline disabled:opacity-60"
            >
              Remove tag
            </button>
          )}
          {contractItems.length > 0 && (
            <button
              onClick={() => setShowContractProgressDialog(true)}
              className="text-[11px] font-medium text-[#4c739a] dark:text-slate-400 hover:text-primary hover:underline"
            >
              + Progress
            </button>
          )}
        </div>
      )}

      {showAssignQaDialog && (
        <AssignUpdateAsQaDialog
          projectId={projectId}
          updateId={update.id}
          updateBody={update.body}
          taggableItems={taggableItems}
          defaultVariationItemId={update.variationItem?.id ?? null}
          onClose={() => setShowAssignQaDialog(false)}
          onAssigned={() => setShowAssignQaDialog(false)}
        />
      )}

      {showContractProgressDialog && (
        <AssignUpdateAsContractProgressDialog
          projectId={projectId}
          updateId={update.id}
          updateDate={update.createdAt.toISOString()}
          contractItems={contractItems}
          onClose={() => setShowContractProgressDialog(false)}
          onAssigned={() => setShowContractProgressDialog(false)}
        />
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
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-2 text-xs font-medium text-[#4c739a] dark:text-slate-400 cursor-pointer">
                <span className="material-symbols-outlined text-base">photo_camera</span>
                Take photo
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  onChange={(event) => {
                    addReplyFiles(event.target.files);
                    event.target.value = "";
                  }}
                  className="hidden"
                />
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-[#4c739a] dark:text-slate-400 cursor-pointer">
                <span className="material-symbols-outlined text-base">attach_file</span>
                Attach files
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
              {replyFiles.length > 0 && (
                <span className="text-xs font-medium text-[#4c739a] dark:text-slate-400">
                  {replyFiles.length} file{replyFiles.length > 1 ? "s" : ""} attached
                </span>
              )}
            </div>
            <AttachmentPreviewList files={replyFiles} onRemove={removeReplyFile} />
            {replyFileError && <p className="text-xs text-red-600 dark:text-red-400">{replyFileError}</p>}
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
