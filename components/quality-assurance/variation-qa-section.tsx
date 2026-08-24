"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { QARecord, QARecordAttachment, VariationItem } from "@prisma/client";
import { QaRecordCard } from "@/components/quality-assurance/qa-record-card";
import { QaRecordFormDialog } from "@/components/quality-assurance/qa-record-form-dialog";

type QaRecordWithItem = QARecord & {
  variationItem: { id: string; reference: string; title: string } | null;
  attachments: QARecordAttachment[];
};

export function VariationQaSection({
  projectId,
  itemId,
  qaRecords,
  taggableItems
}: {
  projectId: string;
  itemId: string;
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
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#cfdbe7] dark:border-slate-800 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold">Quality Assurance</h3>
        <button onClick={openCreateDialog} className="text-xs font-bold text-primary hover:underline">
          + Add
        </button>
      </div>

      {qaRecords.length === 0 ? (
        <p className="text-sm text-[#4c739a] dark:text-slate-400">No QA records linked to this item yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {qaRecords.map((qaRecord) => (
            <QaRecordCard
              key={qaRecord.id}
              projectId={projectId}
              qaRecord={qaRecord}
              showLinkedItem={false}
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
        defaultVariationItemId={itemId}
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
      />
    </div>
  );
}
