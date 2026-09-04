"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SendQaDocumentPanel } from "@/components/quality-assurance/send-qa-document-panel";

type ContactOption = { id: string; name: string; email: string | null; role: string | null };
type SelectableRecord = {
  id: string;
  stage: string;
  notes: string | null;
  date: string; // ISO
  photoCount: number;
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

// "Generate QA Document" — select from every not-yet-included QA record
// (the ones already compiled into an earlier document simply aren't in
// this list at all — see the page loader's own query), reorder the
// selection, review a live summary (the exact rows the PDF's own Summary
// table will show), then Generate. On success this dialog chains straight
// into SendQaDocumentPanel for the document it just created — same
// dialog-chaining pattern already used for Delay Events (create, then
// optionally send, in one continuous flow) — rather than closing and
// making the user find their way back to it separately.
export function GenerateQaDocumentDialog({
  projectId,
  selectableRecords,
  contacts,
  defaultContractReference,
  open,
  onClose
}: {
  projectId: string;
  selectableRecords: SelectableRecord[];
  contacts: ContactOption[];
  defaultContractReference: string;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [siteAddress, setSiteAddress] = useState("");
  const [contractReference, setContractReference] = useState(defaultContractReference);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDocId, setGeneratedDocId] = useState<string | null>(null);

  if (!open) return null;

  const recordsById = new Map(selectableRecords.map((record) => [record.id, record]));
  const selectedRecords = selectedIds.map((id) => recordsById.get(id)).filter((record): record is SelectableRecord => Boolean(record));
  const totalPhotos = selectedRecords.reduce((sum, record) => sum + record.photoCount, 0);

  function toggle(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((existing) => existing !== id) : [...current, id]));
  }
  function move(index: number, direction: -1 | 1) {
    setSelectedIds((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  function remove(id: string) {
    setSelectedIds((current) => current.filter((existing) => existing !== id));
  }

  function handleClose() {
    setSelectedIds([]);
    setSiteAddress("");
    setContractReference(defaultContractReference);
    setError(null);
    setGeneratedDocId(null);
    onClose();
  }

  async function handleGenerate() {
    if (selectedIds.length === 0) {
      setError("Select at least one QA record.");
      return;
    }
    setError(null);
    setIsGenerating(true);
    const response = await fetch(`/api/projects/${projectId}/qa-documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        qaRecordIds: selectedIds,
        siteAddress: siteAddress.trim() || undefined,
        contractReference: contractReference.trim() || undefined
      })
    });
    setIsGenerating(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(typeof body?.error === "string" ? body.error : "Could not generate this document.");
      return;
    }
    const { qaDocument } = await response.json();
    setGeneratedDocId(qaDocument.id);
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="relative w-full max-w-2xl rounded-xl bg-white dark:bg-slate-900 p-6 shadow-lg max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close"
          className="absolute top-3 right-3 rounded-lg p-1 text-[#4c739a] hover:bg-[#e7edf3] dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>

        {generatedDocId ? (
          <>
            <h2 className="text-lg font-bold mb-1">Document ready</h2>
            <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-4">
              The QA Document has been generated and the included records are now filed under it — they'll stay fully viewable, just off
              this list for the next one.
            </p>
            <SendQaDocumentPanel projectId={projectId} qaDocumentId={generatedDocId} contacts={contacts} />
            <div className="flex justify-end mt-4">
              <button onClick={handleClose} className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90">
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-bold mb-1">Generate QA Document</h2>
            <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-5">
              Select the QA records to compile, in the order they should appear. Records already included in a previous document aren't
              shown here — they aren't deleted, just filed.
            </p>

            {selectableRecords.length === 0 ? (
              <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-4">
                No QA records available to compile — every record has already been included in a document, or none exist yet.
              </p>
            ) : (
              <div className="flex flex-col gap-4 mb-4">
                <div>
                  <p className="text-sm font-medium mb-1">Available records</p>
                  <div className="flex flex-col gap-1 max-h-40 overflow-y-auto rounded-lg border border-[#e7edf3] dark:border-slate-700 p-2">
                    {selectableRecords.map((record) => (
                      <label key={record.id} className="flex items-center gap-2 text-xs py-0.5">
                        <input type="checkbox" checked={selectedIds.includes(record.id)} onChange={() => toggle(record.id)} />
                        {formatDate(record.date)} — {record.stage}
                        <span className="text-[#4c739a] dark:text-slate-400">
                          ({record.photoCount} photo{record.photoCount === 1 ? "" : "s"})
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {selectedRecords.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-1">Selected, in document order</p>
                    <div className="flex flex-col gap-1 rounded-lg border border-[#e7edf3] dark:border-slate-700 p-2">
                      {selectedRecords.map((record, index) => (
                        <div key={record.id} className="flex items-center justify-between gap-2 text-xs py-0.5">
                          <span>
                            {index + 1}. {formatDate(record.date)} — {record.notes?.trim() || record.stage}
                          </span>
                          <span className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => move(index, -1)}
                              disabled={index === 0}
                              aria-label="Move up"
                              className="text-[#4c739a] hover:text-primary disabled:opacity-30"
                            >
                              <span className="material-symbols-outlined text-base">arrow_upward</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => move(index, 1)}
                              disabled={index === selectedRecords.length - 1}
                              aria-label="Move down"
                              className="text-[#4c739a] hover:text-primary disabled:opacity-30"
                            >
                              <span className="material-symbols-outlined text-base">arrow_downward</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => remove(record.id)}
                              aria-label="Remove"
                              className="text-[#4c739a] hover:text-red-600"
                            >
                              <span className="material-symbols-outlined text-base">close</span>
                            </button>
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-[#4c739a] dark:text-slate-400 mt-1">
                      {selectedRecords.length} update{selectedRecords.length === 1 ? "" : "s"} · {totalPhotos} photo{totalPhotos === 1 ? "" : "s"}
                    </p>
                  </div>
                )}

                <div className="flex gap-3">
                  <label className="flex flex-col gap-1 text-sm font-medium flex-1">
                    Site Address <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span>
                    <input
                      type="text"
                      value={siteAddress}
                      onChange={(event) => setSiteAddress(event.target.value)}
                      className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm font-medium flex-1">
                    Contract / Job Reference <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span>
                    <input
                      type="text"
                      value={contractReference}
                      onChange={(event) => setContractReference(event.target.value)}
                      className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </label>
                </div>
              </div>
            )}

            {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

            <div className="flex gap-3 justify-end">
              <button type="button" onClick={handleClose} className="h-10 px-4 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-medium">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating || selectedIds.length === 0}
                className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
              >
                {isGenerating ? "Generating..." : "Generate"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
