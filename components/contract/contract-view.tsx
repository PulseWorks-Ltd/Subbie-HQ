"use client";

import { useState } from "react";
import type { Clause, ContractDocument } from "@prisma/client";
import type { ReviewWithChain } from "@/components/contract/contract-review-section";
import type { CoverComparisonRow } from "@/lib/insurance-cover-comparison";
import { UploadDocumentDialog } from "@/components/contract/upload-document-dialog";
import { DocumentPanel } from "@/components/contract/document-panel";
import { InsuranceCoverComparison } from "@/components/contract/insurance-cover-comparison";

export function ContractView({
  projectId,
  documents,
  coverComparison
}: {
  projectId: string;
  documents: (ContractDocument & {
    clauses: Clause[];
    reviews: ReviewWithChain[];
  })[];
  coverComparison: CoverComparisonRow[];
}) {
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Contract</h2>
          <p className="text-sm text-[#4c739a] dark:text-slate-400">
            Contract documents and the clauses recorded against them.
          </p>
        </div>
        <button
          onClick={() => setIsUploadOpen(true)}
          className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 shrink-0"
        >
          Upload Document
        </button>
      </div>

      <InsuranceCoverComparison rows={coverComparison} />

      {documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#cfdbe7] dark:border-slate-700 py-16">
          <p className="font-bold mb-1">No contract documents yet</p>
          <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-5">
            Upload the subcontract agreement to start recording clauses.
          </p>
          <button
            onClick={() => setIsUploadOpen(true)}
            className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90"
          >
            Upload Document
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {documents.map((document) => (
            <DocumentPanel key={document.id} projectId={projectId} document={document} />
          ))}
        </div>
      )}

      <UploadDocumentDialog projectId={projectId} open={isUploadOpen} onClose={() => setIsUploadOpen(false)} />
    </div>
  );
}
