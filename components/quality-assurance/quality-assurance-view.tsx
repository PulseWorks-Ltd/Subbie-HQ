"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { QARecord, QARecordAttachment, VariationItem } from "@prisma/client";
import { QaRecordCard } from "@/components/quality-assurance/qa-record-card";
import { QaRecordFormDialog } from "@/components/quality-assurance/qa-record-form-dialog";
import { GenerateQaDocumentDialog } from "@/components/quality-assurance/generate-qa-document-dialog";

type QaRecordWithItem = QARecord & {
  variationItem: { id: string; reference: string; title: string } | null;
  attachments: QARecordAttachment[];
};
type ContactOption = { id: string; name: string; email: string | null; role: string | null };
type SelectableRecord = { id: string; stage: string; notes: string | null; date: string; photoCount: number };
type QaDocumentRow = {
  id: string;
  docNumber: number;
  generatedAt: string;
  generatedByUser: { firstName: string | null; lastName: string | null; email: string };
  records: { qaRecord: { id: string; stage: string; date: string } }[];
};

function formatQaDocNumber(docNumber: number) {
  return `QA-${String(docNumber).padStart(6, "0")}`;
}
function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

// A past document's own contained-records list, expandable — "view
// previously generated documents and which updates they contain".
function GeneratedDocumentRow({ projectId, doc }: { projectId: string; doc: QaDocumentRow }) {
  const [expanded, setExpanded] = useState(false);
  const generatedByName =
    doc.generatedByUser.firstName || doc.generatedByUser.lastName
      ? `${doc.generatedByUser.firstName ?? ""} ${doc.generatedByUser.lastName ?? ""}`.trim()
      : doc.generatedByUser.email;

  return (
    <div className="rounded-lg border border-[#e7edf3] dark:border-slate-700 p-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-bold">{formatQaDocNumber(doc.docNumber)}</p>
          <p className="text-xs text-[#4c739a] dark:text-slate-400">
            Generated {formatDate(doc.generatedAt)} by {generatedByName} · {doc.records.length} record{doc.records.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <a
            href={`/api/projects/${projectId}/qa-documents/${doc.id}/file`}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-bold text-primary hover:underline"
          >
            Download
          </a>
          <button type="button" onClick={() => setExpanded((current) => !current)} className="text-xs font-medium text-[#4c739a] dark:text-slate-400 hover:underline">
            {expanded ? "Hide" : "Show"} records
          </button>
        </div>
      </div>
      {expanded && (
        <ul className="mt-2 flex flex-col gap-1 pl-3 border-l-2 border-[#e7edf3] dark:border-slate-700">
          {doc.records.map((link) => (
            <li key={link.qaRecord.id} className="text-xs text-[#4c739a] dark:text-slate-400">
              {formatDate(link.qaRecord.date)} — {link.qaRecord.stage}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function QualityAssuranceView({
  projectId,
  qaRecords,
  taggableItems,
  selectableRecords,
  qaDocuments,
  contacts,
  defaultContractReference
}: {
  projectId: string;
  qaRecords: QaRecordWithItem[];
  taggableItems: VariationItem[];
  selectableRecords: SelectableRecord[];
  qaDocuments: QaDocumentRow[];
  contacts: ContactOption[];
  defaultContractReference: string;
}) {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<QARecord | null>(null);
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);

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
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setIsGenerateDialogOpen(true)}
            className="h-10 px-4 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-bold hover:bg-[#f8fafc] dark:hover:bg-slate-800"
          >
            Generate QA Document
          </button>
          <button
            onClick={openCreateDialog}
            className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90"
          >
            Add QA Record
          </button>
        </div>
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

      {qaDocuments.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-bold">Generated Documents</h3>
          <div className="flex flex-col gap-2">
            {qaDocuments.map((doc) => (
              <GeneratedDocumentRow key={doc.id} projectId={projectId} doc={doc} />
            ))}
          </div>
        </div>
      )}

      <QaRecordFormDialog
        projectId={projectId}
        taggableItems={taggableItems}
        record={editingRecord}
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
      />
      <GenerateQaDocumentDialog
        projectId={projectId}
        selectableRecords={selectableRecords}
        contacts={contacts}
        defaultContractReference={defaultContractReference}
        open={isGenerateDialogOpen}
        onClose={() => {
          setIsGenerateDialogOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}
