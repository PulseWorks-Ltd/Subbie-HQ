"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Update, UpdateAttachment, VariationItem } from "@prisma/client";
import { MobileThread } from "@/components/mobile/mobile-thread";
import { getCountdownInfo } from "@/lib/date-countdown";

type Author = { id: string; name: string | null; email: string };
type VariationItemRef = { id: string; reference: string; title: string };
type UpdateWithReplies = Update & {
  author: Author;
  variationItem: VariationItemRef | null;
  attachments: UpdateAttachment[];
  replies: (Update & { author: Author; attachments: UpdateAttachment[] })[];
};

export function MobileUpdatesView({
  projectId,
  updates,
  taggableItems
}: {
  projectId: string;
  updates: UpdateWithReplies[];
  taggableItems: VariationItem[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [variationItemId, setVariationItemId] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openItems = taggableItems.filter((item) => item.status !== "complete");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    setIsSubmitting(true);

    const formData = new FormData();
    formData.set("body", body);
    if (variationItemId) formData.set("variationItemId", variationItemId);
    files.forEach((file) => formData.append("files", file));

    await fetch(`/api/projects/${projectId}/updates`, { method: "POST", body: formData });

    setIsSubmitting(false);
    setBody("");
    setVariationItemId("");
    setFiles([]);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-slate-900 rounded-xl border border-[#e7edf3] dark:border-slate-800 p-4 flex flex-col gap-3"
      >
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={3}
          placeholder="Post a progress update..."
          className="rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <label className="flex items-center gap-2 text-xs font-medium text-[#4c739a] dark:text-slate-400">
          <span className="material-symbols-outlined text-lg">photo_camera</span>
          {files.length > 0 ? `${files.length} photo${files.length > 1 ? "s" : ""} attached` : "Add photo"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
            className="hidden"
          />
        </label>
        {openItems.length > 0 && (
          <select
            value={variationItemId}
            onChange={(event) => setVariationItemId(event.target.value)}
            className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">Not tied to a Variation/SI</option>
            {openItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.reference} · {item.title}
              </option>
            ))}
          </select>
        )}
        <button
          type="submit"
          disabled={isSubmitting || !body.trim()}
          className="h-11 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
        >
          {isSubmitting ? "Posting..." : "Post Update"}
        </button>
      </form>

      {taggableItems.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {taggableItems.map((item) => {
            const urgency = item.status !== "complete" && item.dueAt ? getCountdownInfo(item.dueAt).urgency : null;
            const urgentStyle =
              urgency === "overdue"
                ? "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                : urgency === "today" || urgency === "soon"
                  ? "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                  : item.status === "complete"
                    ? "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400";

            return (
              <span
                key={item.id}
                className={`shrink-0 inline-flex items-center px-2 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${urgentStyle}`}
              >
                {item.reference}
                {(urgency === "overdue" || urgency === "today" || urgency === "soon") &&
                  item.dueAt &&
                  ` · ${getCountdownInfo(item.dueAt).label}`}
              </span>
            );
          })}
        </div>
      )}

      {updates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#e7edf3] dark:border-slate-700 py-12">
          <p className="font-bold mb-1 text-sm">No updates yet</p>
          <p className="text-xs text-[#4c739a] dark:text-slate-400">Post the first update above.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {updates.map((update) => (
            <MobileThread key={update.id} projectId={projectId} update={update} />
          ))}
        </div>
      )}
    </div>
  );
}
