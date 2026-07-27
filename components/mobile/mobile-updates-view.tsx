"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SiteInstruction, Update, UpdateAttachment } from "@prisma/client";
import { MobileThread } from "@/components/mobile/mobile-thread";

type Author = { id: string; name: string | null; email: string };
type SiteInstructionRef = { id: string; reference: string; title: string };
type UpdateWithReplies = Update & {
  author: Author;
  siteInstruction: SiteInstructionRef | null;
  attachments: UpdateAttachment[];
  replies: (Update & { author: Author; attachments: UpdateAttachment[] })[];
};

export function MobileUpdatesView({
  projectId,
  updates,
  siteInstructions
}: {
  projectId: string;
  updates: UpdateWithReplies[];
  siteInstructions: SiteInstruction[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [siteInstructionId, setSiteInstructionId] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openSiteInstructions = siteInstructions.filter((si) => si.status === "open");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    setIsSubmitting(true);

    const formData = new FormData();
    formData.set("body", body);
    if (siteInstructionId) formData.set("siteInstructionId", siteInstructionId);
    files.forEach((file) => formData.append("files", file));

    await fetch(`/api/projects/${projectId}/updates`, { method: "POST", body: formData });

    setIsSubmitting(false);
    setBody("");
    setSiteInstructionId("");
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
        {openSiteInstructions.length > 0 && (
          <select
            value={siteInstructionId}
            onChange={(event) => setSiteInstructionId(event.target.value)}
            className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">Not tied to a Site Instruction</option>
            {openSiteInstructions.map((si) => (
              <option key={si.id} value={si.id}>
                {si.reference} · {si.title}
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

      {siteInstructions.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {siteInstructions.map((si) => (
            <span
              key={si.id}
              className={`shrink-0 inline-flex items-center px-2 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${
                si.status === "complete"
                  ? "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
              }`}
            >
              {si.reference}
            </span>
          ))}
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
