"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SiteInstruction } from "@prisma/client";
import { CountdownBadge } from "@/components/badges/countdown-badge";

function toDateInputValue(date: Date | null) {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

export function SiteInstructionsPanel({
  projectId,
  siteInstructions
}: {
  projectId: string;
  siteInstructions: SiteInstruction[];
}) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [reference, setReference] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [notifiedAt, setNotifiedAt] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [storageKey, setStorageKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  function resetForm() {
    setReference("");
    setTitle("");
    setDescription("");
    setNotifiedAt("");
    setDueAt("");
    setFileName(null);
    setStorageKey(null);
  }

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsParsing(true);

    const formData = new FormData();
    formData.set("file", file);

    const response = await fetch(`/api/projects/${projectId}/site-instructions/parse`, {
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

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const response = await fetch(`/api/projects/${projectId}/site-instructions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reference,
        title,
        description: description || undefined,
        notifiedAt: notifiedAt || undefined,
        dueAt: dueAt || undefined,
        fileName: fileName || undefined,
        storageKey: storageKey || undefined
      })
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(typeof body?.error === "string" ? body.error : "Could not create the site instruction.");
      return;
    }

    resetForm();
    setIsCreating(false);
    router.refresh();
  }

  async function toggleStatus(siteInstruction: SiteInstruction) {
    setUpdatingId(siteInstruction.id);
    const nextStatus = siteInstruction.status === "open" ? "complete" : "open";
    await fetch(`/api/projects/${projectId}/site-instructions/${siteInstruction.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus })
    });
    setUpdatingId(null);
    router.refresh();
  }

  return (
    <div className="w-80 shrink-0 bg-white dark:bg-slate-900 rounded-xl border border-[#cfdbe7] dark:border-slate-800 flex flex-col">
      <div className="p-4 border-b border-[#e7edf3] dark:border-slate-800 flex items-center justify-between">
        <h3 className="text-sm font-bold">Site Instructions</h3>
        <button
          onClick={() => {
            setIsCreating((value) => !value);
            resetForm();
            setError(null);
          }}
          className="text-xs font-bold text-primary hover:underline"
        >
          {isCreating ? "Cancel" : "+ Add"}
        </button>
      </div>

      {isCreating && (
        <form onSubmit={handleCreate} className="p-4 border-b border-[#e7edf3] dark:border-slate-800 flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium">
            Upload SI / NTS <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional — auto-fills below)</span>
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileSelected}
              disabled={isParsing}
              className="text-xs file:mr-2 file:h-8 file:px-2 file:rounded-lg file:border-0 file:bg-primary/10 file:text-primary file:font-bold file:text-xs"
            />
          </label>
          {isParsing && <p className="text-xs text-[#4c739a] dark:text-slate-400">Reading document...</p>}

          <input
            type="text"
            required
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="Reference (e.g. SI-004)"
            className="h-9 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <input
            type="text"
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Title"
            className="h-9 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            placeholder="Description (optional)"
            className="rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <div className="flex gap-2">
            <label className="flex flex-col gap-1 text-xs font-medium flex-1">
              Notified
              <input
                type="date"
                value={notifiedAt}
                onChange={(event) => setNotifiedAt(event.target.value)}
                className="h-9 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium flex-1">
              Due
              <input
                type="date"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
                className="h-9 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting || isParsing}
            className="h-9 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 disabled:opacity-60"
          >
            {isSubmitting ? "Adding..." : "Add"}
          </button>
        </form>
      )}

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {siteInstructions.length === 0 ? (
          <p className="text-xs text-[#4c739a] dark:text-slate-400 px-1 py-2">
            No SIs or NTSs logged for this project yet.
          </p>
        ) : (
          siteInstructions.map((siteInstruction) => (
            <div key={siteInstruction.id} className="rounded-lg border border-[#e7edf3] dark:border-slate-800 p-3">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-xs font-bold">
                  {siteInstruction.reference}
                  <span className="font-normal text-[#4c739a] dark:text-slate-400"> · {siteInstruction.title}</span>
                </p>
              </div>
              {(siteInstruction.notifiedAt || siteInstruction.dueAt) && (
                <p className="text-[11px] text-[#4c739a] dark:text-slate-400 mb-1">
                  {siteInstruction.notifiedAt && `Notified ${toDateInputValue(siteInstruction.notifiedAt)}`}
                  {siteInstruction.notifiedAt && siteInstruction.dueAt && " · "}
                  {siteInstruction.dueAt && `Due ${toDateInputValue(siteInstruction.dueAt)}`}
                </p>
              )}
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                      siteInstruction.status === "complete"
                        ? "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                    }`}
                  >
                    {siteInstruction.status === "complete" ? "Complete" : "Open"}
                  </span>
                  {siteInstruction.status === "open" && siteInstruction.dueAt && (
                    <CountdownBadge date={siteInstruction.dueAt} />
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {siteInstruction.storageKey && (
                    <a
                      href={`/api/projects/${projectId}/site-instructions/${siteInstruction.id}/file`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-bold text-[#4c739a] hover:text-primary"
                    >
                      View file
                    </a>
                  )}
                  <button
                    onClick={() => toggleStatus(siteInstruction)}
                    disabled={updatingId === siteInstruction.id}
                    className="text-[11px] font-bold text-primary hover:underline disabled:opacity-60"
                  >
                    Mark {siteInstruction.status === "complete" ? "open" : "complete"}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
