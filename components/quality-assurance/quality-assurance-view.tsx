"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { QARecord, VariationItem } from "@prisma/client";
import { QaRecordCard } from "@/components/quality-assurance/qa-record-card";
import { QaRecordFormDialog } from "@/components/quality-assurance/qa-record-form-dialog";

type QaRecordWithItem = QARecord & { variationItem: { id: string; reference: string; title: string } | null };

export function QualityAssuranceView({
  projectId,
  qaRecords,
  taggableItems
}: {
  projectId: string;
  qaRecords: QaRecordWithItem[];
  taggableItems: VariationItem[];
}) {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<QARecord | null>(null);

  function openCreateDialog() {
    setEditingRecord(null);
    setIsDialogOpen(true);
  }

  function openEditDialog(record: QARecord) {
    setEditingRecord(record);
    setIsDialogOpen(true);
  }

  async function handleDelete(record: QARecord) {
    if (!confirm(`Delete "${record.stage}"?`)) return;
    await fetch(`/api/projects/${projectId}/qa-records/${record.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Quality Assurance</h2>
          <p className="text-sm text-[#4c739a] dark:text-slate-400">
            QA sign-offs for this project — assigned to the contracted works as a whole, or to a specific
            Variation/Site Instruction.
          </p>
        </div>
        <button
          onClick={openCreateDialog}
          className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 shrink-0"
        >
          Add QA Record
        </button>
      </div>

      {qaRecords.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#cfdbe7] dark:border-slate-700 py-16">
          <p className="font-bold mb-1">No QA records yet</p>
          <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-5">
            Track inspection/sign-off checkpoints here — e.g. "Pre-pour reinforcing inspection" or "Final fix QA."
          </p>
          <button
            onClick={openCreateDialog}
            className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90"
          >
            Add QA Record
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {qaRecords.map((qaRecord) => (
            <QaRecordCard
              key={qaRecord.id}
              projectId={projectId}
              qaRecord={qaRecord}
              onEdit={() => openEditDialog(qaRecord)}
              onDelete={() => handleDelete(qaRecord)}
            />
          ))}
        </div>
      )}

      <QaRecordFormDialog
        projectId={projectId}
        taggableItems={taggableItems}
        record={editingRecord}
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
      />
    </div>
  );
}
