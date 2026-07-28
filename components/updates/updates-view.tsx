"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SiteInstruction, Update, UpdateAttachment } from "@prisma/client";
import { UpdateThread } from "@/components/updates/update-thread";
import { SiteInstructionsPanel } from "@/components/updates/site-instructions-panel";

type Author = { id: string; name: string | null; email: string };
type SiteInstructionRef = { id: string; reference: string; title: string };
type UpdateWithReplies = Update & {
  author: Author;
  siteInstruction: SiteInstructionRef | null;
  attachments: UpdateAttachment[];
  replies: (Update & { author: Author; attachments: UpdateAttachment[] })[];
};

export function UpdatesView({
  projectId,
  updates,
  siteInstructions,
  canManageSiteInstructions
}: {
  projectId: string;
  updates: UpdateWithReplies[];
  siteInstructions: SiteInstruction[];
  canManageSiteInstructions: boolean;
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
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-bold">Updates</h2>
        <p className="text-sm text-[#4c739a] dark:text-slate-400">
          A running, audit-friendly log of what's happening on this project.
        </p>
      </div>

      <div className="flex gap-6 items-start">
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <form
            onSubmit={handleSubmit}
            className="bg-white dark:bg-slate-900 rounded-xl border border-[#cfdbe7] dark:border-slate-800 p-5 flex flex-col gap-3"
          >
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={3}
              placeholder="Post an update for the team..."
              className="rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <label className="flex items-center gap-2 text-xs font-medium text-[#4c739a] dark:text-slate-400">
              <span className="material-symbols-outlined text-lg">photo_camera</span>
              {files.length > 0 ? `${files.length} photo${files.length > 1 ? "s" : ""} attached` : "Attach photos"}
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                className="hidden"
              />
            </label>
            <div className="flex items-center justify-between gap-3">
              {openSiteInstructions.length > 0 ? (
                <select
                  value={siteInstructionId}
                  onChange={(event) => setSiteInstructionId(event.target.value)}
                  className="h-9 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">Not tied to a Site Instruction</option>
                  {openSiteInstructions.map((si) => (
                    <option key={si.id} value={si.id}>
                      {si.reference} · {si.title}
                    </option>
                  ))}
                </select>
              ) : (
                <span />
              )}
              <button
                type="submit"
                disabled={isSubmitting || !body.trim()}
                className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
              >
                {isSubmitting ? "Posting..." : "Post Update"}
              </button>
            </div>
          </form>

          {updates.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#cfdbe7] dark:border-slate-700 py-16">
              <p className="font-bold mb-1">No updates yet</p>
              <p className="text-sm text-[#4c739a] dark:text-slate-400">
                Post the first update to start the project's communication trail.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {updates.map((update) => (
                <UpdateThread key={update.id} projectId={projectId} update={update} />
              ))}
            </div>
          )}
        </div>

        {canManageSiteInstructions && (
          <SiteInstructionsPanel projectId={projectId} siteInstructions={siteInstructions} />
        )}
      </div>
    </div>
  );
}
