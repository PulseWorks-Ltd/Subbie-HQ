"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { VariationItem } from "@prisma/client";

export function VariationQuoteSection({ projectId, item }: { projectId: string; item: VariationItem }) {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";

    setIsUploading(true);
    const formData = new FormData();
    formData.set("file", file);
    await fetch(`/api/projects/${projectId}/variation-items/${item.id}/quote`, { method: "POST", body: formData });
    setIsUploading(false);
    router.refresh();
  }

  async function handleRemove() {
    if (!confirm(`Remove this quote from ${item.reference}? You can upload a new one afterward.`)) return;
    setIsRemoving(true);
    await fetch(`/api/projects/${projectId}/variation-items/${item.id}/quote`, { method: "DELETE" });
    setIsRemoving(false);
    router.refresh();
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#cfdbe7] dark:border-slate-800 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold">Quote</h3>
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-primary hover:underline cursor-pointer">
            {isUploading ? "Uploading..." : item.quoteFileName ? "Replace" : "+ Upload"}
            <input type="file" onChange={handleUpload} disabled={isUploading} className="hidden" />
          </label>
          {item.quoteFileName && (
            <button
              onClick={handleRemove}
              disabled={isRemoving}
              className="text-xs font-bold text-red-600 hover:underline disabled:opacity-60"
            >
              {isRemoving ? "Removing..." : "Remove"}
            </button>
          )}
        </div>
      </div>

      {item.quoteFileName ? (
        <a
          href={`/api/projects/${projectId}/variation-items/${item.id}/quote/file`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <span className="material-symbols-outlined text-lg">description</span>
          {item.quoteFileName}
        </a>
      ) : (
        <p className="text-sm text-[#4c739a] dark:text-slate-400">No quote uploaded yet.</p>
      )}
    </div>
  );
}
