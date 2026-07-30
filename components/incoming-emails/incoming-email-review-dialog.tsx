"use client";

import { useMemo, useState } from "react";
import { INBOUND_EMAIL_TYPE_PRESETS } from "@/lib/inbound-email-types";
import type { IncomingEmailRow, ProjectOption } from "@/components/incoming-emails/incoming-emails-view";

// Loose match, not a strict enum comparison — category is free text (see
// lib/inbound-email-types.ts), and a reviewer may have typed a slight
// variation on the preset ("Site Instructions", "site instruction", etc).
function matchItemType(category: string): "variation" | "site_instruction" | null {
  const lower = category.toLowerCase();
  if (lower.includes("site instruction")) return "site_instruction";
  if (lower.includes("variation")) return "variation";
  return null;
}

// "SI-83", "SI83", "si 83" should all collide — references get typed and
// re-typed slightly differently across an email thread and manual entry, so
// comparing raw strings would let obvious duplicates through.
function normalizeReference(reference: string): string {
  return reference.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

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

  // Creating a brand-new Variation/Site Instruction from this email's
  // (AI-extracted, human-reviewed) details — mutually exclusive with
  // variationItemId above (linking to something that already exists).
  const [isExtracting, setIsExtracting] = useState(false);
  const [newItem, setNewItem] = useState<{
    reference: string;
    title: string;
    description: string;
    notifiedAt: string;
    dueAt: string;
  } | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  // Set when extraction finds a reference that already exists on this
  // project (any status — a completed Site Instruction still counts as
  // "already exists") — blocks creating a duplicate and auto-links to the
  // existing item instead, so the email still ends up connected to a real
  // Site Instruction/Variation rather than a dead end.
  const [duplicateNotice, setDuplicateNotice] = useState<string | null>(null);

  const selectedProject = useMemo(() => projects.find((project) => project.id === projectId), [projects, projectId]);
  const matchedItemType = useMemo(() => matchItemType(category), [category]);
  const itemTypeLabel = matchedItemType === "site_instruction" ? "Site Instruction" : "Variation";

  async function handleExtractDetails() {
    if (!matchedItemType || !selectedProject) return;
    setIsExtracting(true);
    setExtractError(null);
    setDuplicateNotice(null);
    try {
      const response = await fetch(`/api/organisation/incoming-emails/${email.id}/extract-variation-item`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: matchedItemType })
      });
      const data = await response.json();
      if (!response.ok) {
        setExtractError(data.error || "Could not extract details.");
        return;
      }

      const extractedReference: string = data.extracted.reference ?? "";
      const existingMatch = extractedReference
        ? selectedProject.variationItems.find(
            (item) => item.type === matchedItemType && normalizeReference(item.reference) === normalizeReference(extractedReference)
          )
        : undefined;

      if (existingMatch) {
        setNewItem(null);
        setVariationItemId(existingMatch.id);
        setDuplicateNotice(
          `This matches an existing ${itemTypeLabel} — ${existingMatch.reference} · ${existingMatch.title}. Filing will link to it instead of creating a duplicate.`
        );
        return;
      }

      setVariationItemId("");
      setNewItem({
        reference: extractedReference,
        title: data.extracted.title ?? "",
        description: data.extracted.summary ?? "",
        notifiedAt: data.extracted.notifiedAt ?? "",
        dueAt: data.extracted.dueAt ?? ""
      });
    } finally {
      setIsExtracting(false);
    }
  }

  // Not wired to <form onSubmit> — with two action buttons visible at once
  // (plain file vs. extract & create), an implicit Enter-triggered submit
  // would always fire whichever button happens to be type="submit" first in
  // the DOM, regardless of which one is visually primary. Both actions are
  // explicit button clicks instead, so there's no ambiguity about which one
  // Enter would silently trigger.
  async function handleFile() {
    if (!projectId || !category.trim()) return;
    if (newItem && (!newItem.reference.trim() || !newItem.title.trim())) return;
    setIsSubmitting(true);
    setError(null);

    const response = await fetch(`/api/organisation/incoming-emails/${email.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "file",
        projectId,
        category: category.trim(),
        variationItemId: newItem ? undefined : variationItemId || undefined,
        createVariationItem:
          newItem && matchedItemType
            ? {
                type: matchedItemType,
                reference: newItem.reference.trim(),
                title: newItem.title.trim(),
                description: newItem.description.trim() || undefined,
                notifiedAt: newItem.notifiedAt || undefined,
                dueAt: newItem.dueAt || undefined
              }
            : undefined
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

  // Nothing left to extract once a link is already resolved (manually picked
  // or auto-matched as a duplicate), once a new item is being reviewed, or
  // when the category isn't a Variation/Site Instruction at all — in every
  // one of those states there's a single unambiguous confirm action. Only
  // the initial, ambiguous state (matched type, nothing chosen yet) needs the
  // three-way choice between filing plain, linking, or creating.
  const showExtractChoice = Boolean(matchedItemType && !newItem && !variationItemId);

  const canSubmitPlain = !isSubmitting && Boolean(projectId) && Boolean(category.trim());

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

          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Project
              <select
                value={projectId}
                onChange={(event) => {
                  setProjectId(event.target.value);
                  setVariationItemId("");
                  setDuplicateNotice(null);
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

            {selectedProject && matchedItemType && !newItem && selectedProject.variationItems.length > 0 && (
              <label className="flex flex-col gap-1 text-sm font-medium">
                Link to an existing Variation/Site Instruction
                <select
                  value={variationItemId}
                  onChange={(event) => {
                    setVariationItemId(event.target.value);
                    setDuplicateNotice(null);
                  }}
                  className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">Not linked</option>
                  {selectedProject.variationItems
                    .filter((item) => item.type === matchedItemType)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.reference} · {item.title}
                        {item.status === "complete" ? " (complete)" : ""}
                      </option>
                    ))}
                </select>
              </label>
            )}

            {duplicateNotice && <p className="text-xs text-amber-700 dark:text-amber-400">{duplicateNotice}</p>}
            {extractError && <p className="text-xs text-red-600 dark:text-red-400">{extractError}</p>}

            {newItem && (
              <div className="rounded-lg border border-[#e7edf3] dark:border-slate-700 p-3 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold">New {itemTypeLabel} — review before saving</p>
                  <button
                    type="button"
                    onClick={() => setNewItem(null)}
                    className="text-xs font-medium text-[#4c739a] dark:text-slate-400 hover:underline"
                  >
                    Cancel
                  </button>
                </div>
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Reference
                  <input
                    value={newItem.reference}
                    onChange={(event) => setNewItem({ ...newItem, reference: event.target.value })}
                    required
                    className="h-9 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Title
                  <input
                    value={newItem.title}
                    onChange={(event) => setNewItem({ ...newItem, title: event.target.value })}
                    required
                    className="h-9 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Description
                  <textarea
                    value={newItem.description}
                    onChange={(event) => setNewItem({ ...newItem, description: event.target.value })}
                    rows={2}
                    className="rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </label>
                <div className="flex gap-3">
                  <label className="flex-1 flex flex-col gap-1 text-sm font-medium">
                    Notified date
                    <input
                      type="date"
                      value={newItem.notifiedAt}
                      onChange={(event) => setNewItem({ ...newItem, notifiedAt: event.target.value })}
                      className="h-9 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </label>
                  <label className="flex-1 flex flex-col gap-1 text-sm font-medium">
                    Due date
                    <input
                      type="date"
                      value={newItem.dueAt}
                      onChange={(event) => setNewItem({ ...newItem, dueAt: event.target.value })}
                      className="h-9 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </label>
                </div>
              </div>
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

              {showExtractChoice && (
                <button
                  type="button"
                  onClick={handleFile}
                  disabled={!canSubmitPlain}
                  className="h-10 px-4 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-medium disabled:opacity-60"
                >
                  {isSubmitting ? "Filing..." : "File to Correspondence"}
                </button>
              )}

              {showExtractChoice ? (
                <button
                  type="button"
                  onClick={handleExtractDetails}
                  disabled={isExtracting || !selectedProject}
                  className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
                >
                  {isExtracting ? "Extracting..." : `Extract & Create ${itemTypeLabel}`}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFile}
                  disabled={
                    isSubmitting ||
                    !projectId ||
                    !category.trim() ||
                    Boolean(newItem && (!newItem.reference.trim() || !newItem.title.trim()))
                  }
                  className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
                >
                  {isSubmitting ? "Filing..." : newItem ? "Create & file to Correspondence" : "File to Correspondence"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
