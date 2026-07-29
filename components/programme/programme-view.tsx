"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ContractDocument, ProgrammeItem } from "@prisma/client";
import { ProgrammeItemCard } from "@/components/programme/programme-item-card";
import { ProgrammeItemFormDialog } from "@/components/programme/programme-item-form-dialog";

type ProgrammeItemWithSource = ProgrammeItem & { sourceDocument: ContractDocument | null };

function sortItems(items: ProgrammeItemWithSource[]) {
  return [...items].sort((a, b) => {
    if (a.startDate && b.startDate) return a.startDate.getTime() - b.startDate.getTime();
    if (a.startDate && !b.startDate) return -1;
    if (!a.startDate && b.startDate) return 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

export function ProgrammeView({
  projectId,
  items,
  activeDocument,
  initialTradeReference
}: {
  projectId: string;
  items: ProgrammeItemWithSource[];
  activeDocument: ContractDocument | null;
  initialTradeReference: string;
}) {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ProgrammeItemWithSource | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [tradeReference, setTradeReference] = useState(initialTradeReference);
  // Tracks the document currently being processed in the background (either
  // one we just uploaded, or one still processing from before this page was
  // loaded) — null once it reaches "ready"/"failed", which stops polling.
  const [processingDocumentId, setProcessingDocumentId] = useState<string | null>(() =>
    activeDocument?.processingStatus === "processing" || activeDocument?.processingStatus === "idle"
      ? activeDocument.id
      : null
  );

  const sortedItems = sortItems(items);
  const completedCount = items.filter((item) => item.completedAt).length;
  const needsReviewCount = items.filter((item) => item.status === "parsed" && !item.completedAt).length;

  useEffect(() => {
    if (!processingDocumentId || activeDocument?.id !== processingDocumentId) return;

    if (activeDocument.processingStatus === "ready") {
      setUploadMessage(`Programme processed — ${items.length} milestone(s) extracted.`);
      setProcessingDocumentId(null);
      return;
    }
    if (activeDocument.processingStatus === "failed") {
      setUploadError(activeDocument.processingError ?? "Could not read this document automatically.");
      setProcessingDocumentId(null);
      return;
    }

    const interval = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(interval);
  }, [processingDocumentId, activeDocument, items.length, router]);

  function openCreateDialog() {
    setEditingItem(null);
    setIsDialogOpen(true);
  }

  function openEditDialog(item: ProgrammeItemWithSource) {
    setEditingItem(item);
    setIsDialogOpen(true);
  }

  async function handleDelete(item: ProgrammeItemWithSource) {
    if (!confirm(`Delete milestone "${item.title}"?`)) return;
    await fetch(`/api/projects/${projectId}/programme/${item.id}`, { method: "DELETE" });
    router.refresh();
  }

  async function handleToggleComplete(item: ProgrammeItemWithSource) {
    await fetch(`/api/projects/${projectId}/programme/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completedAt: item.completedAt ? null : new Date().toISOString() })
    });
    router.refresh();
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";

    setIsUploading(true);
    setUploadMessage(null);
    setUploadError(null);

    const formData = new FormData();
    formData.set("file", file);
    if (tradeReference.trim()) {
      formData.set("tradeReference", tradeReference.trim());
    }

    const response = await fetch(`/api/projects/${projectId}/programme/parse`, {
      method: "POST",
      body: formData
    });

    const body = await response.json().catch(() => null);
    setIsUploading(false);

    if (!response.ok) {
      setUploadError(
        typeof body?.error === "string" ? body.error : "Could not read this document automatically."
      );
      router.refresh();
      return;
    }

    setProcessingDocumentId(body.document.id);
    setUploadMessage(
      `${file.name} uploaded — processing it automatically now (this can take a little while for longer documents). This page will update on its own once milestones are ready.`
    );
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Programme</h2>
          <p className="text-sm text-[#4c739a] dark:text-slate-400">
            What's expected to start and finish, and when.
          </p>
        </div>
        <div className="flex items-end gap-2 shrink-0">
          <label className="flex flex-col gap-1 text-xs font-medium">
            Trade reference <span className="font-normal text-[#4c739a] dark:text-slate-400">(as shown in the programme)</span>
            <input
              type="text"
              value={tradeReference}
              onChange={(event) => setTradeReference(event.target.value)}
              placeholder="e.g. NSS"
              className="h-10 w-36 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
          <label
            className={`h-10 px-4 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-bold flex items-center ${
              isUploading || processingDocumentId ? "opacity-60 cursor-not-allowed" : "hover:bg-[#e7edf3] dark:hover:bg-slate-800 cursor-pointer"
            }`}
          >
            {isUploading ? "Uploading..." : processingDocumentId ? "Processing..." : activeDocument ? "Upload revised programme" : "Upload programme"}
            <input
              type="file"
              accept="application/pdf"
              onChange={handleUpload}
              disabled={isUploading || !!processingDocumentId}
              className="hidden"
            />
          </label>
          <button
            onClick={openCreateDialog}
            className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90"
          >
            Add Milestone
          </button>
        </div>
      </div>

      {activeDocument && (
        <p className="text-xs text-[#4c739a] dark:text-slate-400 -mt-4">
          Current programme document:{" "}
          <a
            href={`/api/projects/${projectId}/contract-documents/${activeDocument.id}/file`}
            target="_blank"
            rel="noreferrer"
            className="font-bold text-primary hover:underline"
          >
            {activeDocument.fileName}
          </a>
        </p>
      )}

      {uploadMessage && (
        <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/40 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          {uploadMessage}
        </div>
      )}
      {uploadError && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          {uploadError}
        </div>
      )}

      {items.length > 0 && (
        <div className="flex gap-6 text-sm text-[#4c739a] dark:text-slate-400">
          <span>{items.length} total</span>
          <span>{completedCount} completed</span>
          {needsReviewCount > 0 && (
            <span className="text-amber-600 font-medium">{needsReviewCount} awaiting review</span>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#cfdbe7] dark:border-slate-700 py-16">
          <p className="font-bold mb-1">No programme items yet</p>
          <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-5">
            Upload a programme document to extract milestones automatically, or add them manually.
          </p>
          <button
            onClick={openCreateDialog}
            className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90"
          >
            Add Milestone
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedItems.map((item) => (
            <ProgrammeItemCard
              key={item.id}
              item={item}
              projectId={projectId}
              onEdit={() => openEditDialog(item)}
              onDelete={() => handleDelete(item)}
              onToggleComplete={() => handleToggleComplete(item)}
            />
          ))}
        </div>
      )}

      <ProgrammeItemFormDialog
        projectId={projectId}
        item={editingItem}
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
      />
    </div>
  );
}
