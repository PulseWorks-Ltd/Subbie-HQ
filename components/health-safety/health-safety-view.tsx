"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SafetyDocument, SafetyDocumentType } from "@prisma/client";
import { HealthSafetyItemCard } from "@/components/health-safety/health-safety-item-card";
import { HealthSafetyItemFormDialog } from "@/components/health-safety/health-safety-item-form-dialog";
import { SAFETY_DOCUMENT_TYPES, SAFETY_DOCUMENT_TYPE_LABELS } from "@/lib/safety-document-types";

type FilterKey = "all" | SafetyDocumentType;

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
  const [filter, setFilter] = useState<FilterKey>("all");

  // Only offer a tab for a type that's actually in use on this project —
  // an empty tab for every possible category would just be clutter (Task
  // 1.2: "genuinely usable for finding a specific type", not a fixed menu).
  const typesInUse = SAFETY_DOCUMENT_TYPES.filter((type) => safetyDocuments.some((document) => document.type === type));
  const filteredDocuments = safetyDocuments.filter((document) => filter === "all" || document.type === filter);

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
        <>
          {typesInUse.length > 1 && (
            <div className="flex gap-1 border-b border-[#e7edf3] dark:border-slate-800 overflow-x-auto">
              {(["all", ...typesInUse] as FilterKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`px-4 py-2 text-sm font-bold whitespace-nowrap border-b-2 -mb-px ${
                    filter === key
                      ? "text-primary border-primary"
                      : "text-[#4c739a] dark:text-slate-400 border-transparent hover:text-primary"
                  }`}
                >
                  {key === "all" ? "All" : SAFETY_DOCUMENT_TYPE_LABELS[key]}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredDocuments.map((document) => (
              <HealthSafetyItemCard
                key={document.id}
                document={document}
                projectId={projectId}
                onEdit={() => openEditDialog(document)}
                onDelete={() => handleDelete(document)}
              />
            ))}
          </div>
        </>
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
