"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SafetyDocument } from "@prisma/client";
import { HealthSafetyItemCard } from "@/components/health-safety/health-safety-item-card";
import { HealthSafetyItemFormDialog } from "@/components/health-safety/health-safety-item-form-dialog";

export function HealthSafetyView({
  projectId,
  safetyDocuments
}: {
  projectId: string;
  safetyDocuments: SafetyDocument[];
}) {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<SafetyDocument | null>(null);

  function openCreateDialog() {
    setEditingDocument(null);
    setIsDialogOpen(true);
  }

  function openEditDialog(document: SafetyDocument) {
    setEditingDocument(document);
    setIsDialogOpen(true);
  }

  async function handleDelete(document: SafetyDocument) {
    if (!confirm(`Delete "${document.title}"?`)) return;
    await fetch(`/api/projects/${projectId}/safety-documents/${document.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Health &amp; Safety</h2>
          <p className="text-sm text-[#4c739a] dark:text-slate-400">
            Safety documentation for this project, and when it needs renewing.
          </p>
        </div>
        <button
          onClick={openCreateDialog}
          className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 shrink-0"
        >
          Add Document
        </button>
      </div>

      {safetyDocuments.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#cfdbe7] dark:border-slate-700 py-16">
          <p className="font-bold mb-1">No safety documents yet</p>
          <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-5">
            Track SSSPs, hazard registers, and other H&amp;S documents here — with an expiry date if they need renewing.
          </p>
          <button
            onClick={openCreateDialog}
            className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90"
          >
            Add Document
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {safetyDocuments.map((document) => (
            <HealthSafetyItemCard
              key={document.id}
              document={document}
              projectId={projectId}
              onEdit={() => openEditDialog(document)}
              onDelete={() => handleDelete(document)}
            />
          ))}
        </div>
      )}

      <HealthSafetyItemFormDialog
        projectId={projectId}
        document={editingDocument}
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
      />
    </div>
  );
}
