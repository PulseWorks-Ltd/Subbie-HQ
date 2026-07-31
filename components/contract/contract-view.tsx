"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // Background clause extraction and contract review both run detached from
  // any request (see lib/document-processing.ts / lib/contract-comparison.ts)
  // — this page is a Server Component fetched once on load, so nothing was
  // ever re-fetching while the user just sat here watching. Polling used to
  // live inside ContractReviewSection instead, but that component only
  // mounts (and only runs its own poll) while its document's panel is
  // expanded — a freshly-uploaded document's panel starts collapsed, so
  // nothing polled until the user expanded it or navigated away and back.
  // Polling here instead, at the always-mounted top level, matches the fix
  // already applied to the Incoming Emails tab and works regardless of
  // which panels are expanded/collapsed.
  const isAnyDocumentPending = documents.some(
    (document) =>
      document.clauses.length === 0 && (document.processingStatus === "idle" || document.processingStatus === "processing")
  );
  const isAnyReviewRunning = documents.some((document) => document.reviews[0]?.status === "running");

  useEffect(() => {
    if (!isAnyDocumentPending && !isAnyReviewRunning) return;
    const interval = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(interval);
  }, [isAnyDocumentPending, isAnyReviewRunning, router]);

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
