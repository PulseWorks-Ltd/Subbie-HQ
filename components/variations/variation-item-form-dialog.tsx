"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { VariationItem } from "@prisma/client";

function toDateInputValue(date: Date | null) {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

export function VariationItemFormDialog({
  projectId,
  item,
  defaultType,
  openSiteInstructions = [],
  open,
  onClose
}: {
  projectId: string;
  item?: VariationItem | null;
  defaultType: "variation" | "site_instruction";
  openSiteInstructions?: VariationItem[];
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const isEditing = Boolean(item);
  const hasVariation = item?.variationCreatedAt != null;

  const [type, setType] = useState<"variation" | "site_instruction">(item?.type ?? defaultType);
  const [reference, setReference] = useState(item?.reference ?? "");
  const [title, setTitle] = useState(item?.title ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [notifiedAt, setNotifiedAt] = useState(toDateInputValue(item?.notifiedAt ?? null));
  const [dueAt, setDueAt] = useState(toDateInputValue(item?.dueAt ?? null));
  const [instructedByName, setInstructedByName] = useState(item?.instructedByName ?? "");
  const [status, setStatus] = useState(item?.status ?? "open");
  const [percentComplete, setPercentComplete] = useState(
    item?.percentComplete != null ? String(item.percentComplete) : ""
  );
  const [variationValue, setVariationValue] = useState(item?.variationValue != null ? String(item.variationValue) : "");
  // Only relevant when creating a brand-new type: "variation" — picking an
  // existing SI here means this form upgrades THAT record (adds a Variation
  // identity to it) instead of creating a separate new item. Same-record
  // logic, not a new row.
  const [linkedSiteInstructionId, setLinkedSiteInstructionId] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [storageKey, setStorageKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) return null;

  const isLinkingToSI = !isEditing && type === "variation" && Boolean(linkedSiteInstructionId);

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsParsing(true);

    const formData = new FormData();
    formData.set("file", file);
    formData.set("type", type);

    const response = await fetch(`/api/projects/${projectId}/variation-items/parse`, {
      method: "POST",
      body: formData
    });

    const body = await response.json().catch(() => null);
    setIsParsing(false);

    if (body?.storageKey) {
      setStorageKey(body.storageKey);
      setFileName(body.fileName ?? file.name);
    }

    if (!response.ok) {
      setError(typeof body?.error === "string" ? body.error : "Could not read this document automatically.");
      return;
    }

    const extracted = body.extracted;
    setReference(extracted.reference);
    setTitle(extracted.title);
    setDescription(extracted.summary);
    setNotifiedAt(extracted.notifiedAt ?? "");
    setDueAt(extracted.dueAt ?? "");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const response = isEditing
      ? await fetch(`/api/projects/${projectId}/variation-items/${item!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reference,
            title,
            description: description || null,
            status,
            percentComplete: percentComplete ? Number(percentComplete) : null,
            notifiedAt: notifiedAt ? new Date(notifiedAt).toISOString() : undefined,
            dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
            instructedByName: instructedByName || null,
            variationValue: hasVariation ? (variationValue ? Number(variationValue) : null) : undefined
          })
        })
      : isLinkingToSI
        ? // Upgrading the picked SI in place — same record, no new row.
          await fetch(`/api/projects/${projectId}/variation-items/${linkedSiteInstructionId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              createVariation: true,
              variationValue: variationValue ? Number(variationValue) : undefined,
              status
            })
          })
        : await fetch(`/api/projects/${projectId}/variation-items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type,
              reference,
              title,
              description: description || undefined,
              notifiedAt: notifiedAt || undefined,
              dueAt: dueAt || undefined,
              fileName: fileName || undefined,
              storageKey: storageKey || undefined,
              instructedByName: instructedByName || undefined,
              variationValue: type === "variation" && variationValue ? Number(variationValue) : undefined
            })
          });

    setIsSubmitting(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(typeof body?.error === "string" ? body.error : "Could not save this item.");
      return;
    }

    onClose();
    router.refresh();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 p-6 shadow-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold mb-1">
          {isEditing ? "Edit item" : type === "variation" ? "Add Variation" : "Add Site Instruction"}
        </h2>
        <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-5">
          {isEditing ? "Update the details for this item." : "Upload a document to auto-fill details, or enter them manually."}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {!isEditing && (
            <div className="flex gap-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="radio"
                  checked={type === "variation"}
                  onChange={() => setType("variation")}
                  className="size-4"
                />
                Variation
              </label>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="radio"
                  checked={type === "site_instruction"}
                  onChange={() => {
                    setType("site_instruction");
                    setLinkedSiteInstructionId("");
                  }}
                  className="size-4"
                />
                Site Instruction
              </label>
            </div>
          )}

          {!isEditing && type === "variation" && openSiteInstructions.length > 0 && (
            <label className="flex flex-col gap-1 text-sm font-medium">
              Link to an existing Site Instruction <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span>
              <select
                value={linkedSiteInstructionId}
                onChange={(event) => setLinkedSiteInstructionId(event.target.value)}
                className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">Not linked — create a new item</option>
                {openSiteInstructions.map((si) => (
                  <option key={si.id} value={si.id}>
                    {si.reference} · {si.title}
                  </option>
                ))}
              </select>
              {isLinkingToSI && (
                <span className="font-normal text-[#4c739a] dark:text-slate-400 mt-1">
                  This upgrades {openSiteInstructions.find((si) => si.id === linkedSiteInstructionId)?.reference} to also be a
                  Variation — same record, everything already attached to it stays.
                </span>
              )}
            </label>
          )}

          {!isLinkingToSI && (
            <>
              {!isEditing && (
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Upload document{" "}
                  <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional — auto-fills below)</span>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileSelected}
                    disabled={isParsing}
                    className="text-sm file:mr-2 file:h-9 file:px-3 file:rounded-lg file:border-0 file:bg-primary/10 file:text-primary file:font-bold file:text-xs"
                  />
                </label>
              )}
              {isParsing && <p className="text-sm text-[#4c739a] dark:text-slate-400">Reading document...</p>}

              <label className="flex flex-col gap-1 text-sm font-medium">
                Reference
                <input
                  type="text"
                  required
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  placeholder={type === "variation" ? "e.g. V44" : "e.g. SI-118"}
                  className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Title
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Description <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span>
                <textarea
                  value={description ?? ""}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={2}
                  className="rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </label>

              <div className="flex gap-3">
                <label className="flex flex-col gap-1 text-sm font-medium flex-1">
                  Notified
                  <input
                    type="date"
                    value={notifiedAt}
                    onChange={(event) => setNotifiedAt(event.target.value)}
                    className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium flex-1">
                  Due
                  <input
                    type="date"
                    value={dueAt}
                    onChange={(event) => setDueAt(event.target.value)}
                    className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Instructed by <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span>
                <input
                  type="text"
                  value={instructedByName}
                  onChange={(event) => setInstructedByName(event.target.value)}
                  placeholder="e.g. J. Smith, Site Manager"
                  className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </label>
            </>
          )}

          {(type === "variation" || hasVariation) && (
            <label className="flex flex-col gap-1 text-sm font-medium">
              Variation value
              <input
                type="number"
                min={0}
                step="0.01"
                value={variationValue}
                onChange={(event) => setVariationValue(event.target.value)}
                placeholder="0.00"
                className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>
          )}

          {(isEditing || isLinkingToSI) && (
            <div className="flex gap-3">
              <label className="flex flex-col gap-1 text-sm font-medium flex-1">
                Status
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as typeof status)}
                  className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="draft">Draft</option>
                  <option value="open">Open</option>
                  {(hasVariation || isLinkingToSI) && <option value="submitted_for_claim">Submitted for Claim</option>}
                  <option value="complete">Complete</option>
                </select>
              </label>
              {isEditing && (
                <label className="flex flex-col gap-1 text-sm font-medium flex-1">
                  % Complete
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={percentComplete}
                    onChange={(event) => setPercentComplete(event.target.value)}
                    className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </label>
              )}
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 justify-end mt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isParsing}
              className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
            >
              {isSubmitting ? "Saving..." : isEditing ? "Save changes" : isLinkingToSI ? "Create Variation" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
