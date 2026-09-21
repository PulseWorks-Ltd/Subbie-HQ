"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

// "Import Existing Payment Claim" (Section 7/35/36) — upload only; the
// mandatory review/match screen lives at its own route
// (/projects/[projectId]/payment-claims/import/[importId]), which this
// navigates to on success. Uploading a real SA-2017 PDF through vision
// extraction can take a while, so this shows a real processing state
// rather than a spinner-less wait (Section 44).
export function ImportPaymentClaimDialog({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<"idle" | "uploading" | "processing">("idle");
  const [error, setError] = useState<string | null>(null);
  const [duplicateImportId, setDuplicateImportId] = useState<string | null>(null);

  async function handleImport() {
    if (!file) return;
    setError(null);
    setDuplicateImportId(null);
    setStage("uploading");
    try {
      const formData = new FormData();
      formData.append("file", file);
      setStage("processing");
      const response = await fetch(`/api/projects/${projectId}/payment-claim-imports`, { method: "POST", body: formData });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 409 && data.existingImportId) {
          setDuplicateImportId(data.existingImportId);
        }
        setError(typeof data.error === "string" ? data.error : "Could not process this document.");
        return;
      }
      router.push(`/projects/${projectId}/payment-claims/import/${data.import.id}`);
    } finally {
      setStage("idle");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="relative w-full max-w-md rounded-xl bg-white dark:bg-slate-900 p-6 shadow-lg">
        <h2 className="text-lg font-bold mb-1">Import Existing Payment Claim</h2>
        <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-4">
          Already underway? Upload your latest payment claim (SA-2017 format, PDF) to establish this project&apos;s current
          commercial position — Subbie HQ will read it, and you&apos;ll review everything before anything is imported.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setError(null);
            setDuplicateImportId(null);
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-24 rounded-lg border-2 border-dashed border-[#cfdbe7] dark:border-slate-700 flex flex-col items-center justify-center gap-1 text-sm text-[#4c739a] dark:text-slate-400 hover:border-primary/50"
        >
          <span className="material-symbols-outlined text-2xl">upload_file</span>
          {file ? file.name : "Choose a PDF"}
        </button>

        {stage !== "idle" && (
          <p className="text-xs text-primary mt-3">{stage === "uploading" ? "Uploading..." : "Reading the document — this can take a moment..."}</p>
        )}

        {error && (
          <div className="text-sm text-red-600 dark:text-red-400 mt-3">
            <p>{error}</p>
            {duplicateImportId && (
              <button
                type="button"
                onClick={() => router.push(`/projects/${projectId}/payment-claims/import/${duplicateImportId}`)}
                className="text-primary hover:underline font-bold mt-1"
              >
                View the existing import
              </button>
            )}
          </div>
        )}

        <div className="flex gap-3 justify-end mt-5">
          <button onClick={onClose} className="h-10 px-4 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-medium">
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!file || stage !== "idle"}
            className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
          >
            {stage === "idle" ? "Upload & Extract" : "Working..."}
          </button>
        </div>
      </div>
    </div>
  );
}
