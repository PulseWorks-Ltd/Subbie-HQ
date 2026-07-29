"use client";

import { useMemo, useState } from "react";
import { INBOUND_EMAIL_TYPE_PRESETS } from "@/lib/inbound-email-types";
import type { IncomingEmailRow, ProjectOption } from "@/components/incoming-emails/incoming-emails-view";

export function IncomingEmailReviewDialog({
  email,
  projects,
  onClose,
  onFiled
}: {
  email: IncomingEmailRow;
  projects: ProjectOption[];
  onClose: () => void;
  onFiled: () => void;
}) {
  const [projectId, setProjectId] = useState(email.suggestedProject?.id ?? "");
  const [category, setCategory] = useState(email.suggestedType ?? "");
  const [variationItemId, setVariationItemId] = useState(email.suggestedVariationItem?.id ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProject = useMemo(() => projects.find((project) => project.id === projectId), [projects, projectId]);

  async function handleFile(event: React.FormEvent) {
    event.preventDefault();
    if (!projectId || !category.trim()) return;
    setIsSubmitting(true);
    setError(null);

    const response = await fetch(`/api/organisation/incoming-emails/${email.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "file",
        projectId,
        category: category.trim(),
        variationItemId: variationItemId || undefined
      })
    });

    setIsSubmitting(false);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error || "Could not file this email.");
      return;
    }
    onFiled();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#e7edf3] dark:border-slate-800 w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="p-5 border-b border-[#e7edf3] dark:border-slate-800">
          <p className="font-bold">{email.subject}</p>
          <p className="text-xs text-[#4c739a] dark:text-slate-400">From {email.sender}</p>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div className="max-h-40 overflow-y-auto rounded-lg bg-[#f6f7f8] dark:bg-slate-800 p-3 text-sm whitespace-pre-wrap">
            {email.body}
          </div>

          <form onSubmit={handleFile} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Project
              <select
                value={projectId}
                onChange={(event) => {
                  setProjectId(event.target.value);
                  setVariationItemId("");
                }}
                required
                className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">Select a project...</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Type
              <input
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                list="incoming-email-type-presets"
                placeholder="e.g. Variation"
                required
                className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <datalist id="incoming-email-type-presets">
                {INBOUND_EMAIL_TYPE_PRESETS.map((preset) => (
                  <option key={preset} value={preset} />
                ))}
              </datalist>
            </label>

            {selectedProject && selectedProject.variationItems.length > 0 && (
              <label className="flex flex-col gap-1 text-sm font-medium">
                Link to Variation/Site Instruction (optional)
                <select
                  value={variationItemId}
                  onChange={(event) => setVariationItemId(event.target.value)}
                  className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">Not linked</option>
                  {selectedProject.variationItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.reference} · {item.title}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="h-10 px-4 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !projectId || !category.trim()}
                className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
              >
                {isSubmitting ? "Filing..." : "File to Correspondence"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
