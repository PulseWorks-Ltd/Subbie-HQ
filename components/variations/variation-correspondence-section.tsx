"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Correspondence } from "@prisma/client";

export function VariationCorrespondenceSection({
  projectId,
  itemId,
  reference,
  correspondence
}: {
  projectId: string;
  itemId: string;
  reference: string;
  correspondence: Correspondence[];
}) {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";

    setIsUploading(true);
    const formData = new FormData();
    formData.set("title", file.name);
    formData.set("variationItemId", itemId);
    formData.set("file", file);
    await fetch(`/api/projects/${projectId}/correspondence`, { method: "POST", body: formData });
    setIsUploading(false);
    router.refresh();
  }

  async function handleUnlink(correspondenceId: string) {
    if (!confirm(`Unlink this email from ${reference}? It will remain in Correspondence.`)) return;
    setUnlinkingId(correspondenceId);
    await fetch(`/api/projects/${projectId}/variation-items/${itemId}/correspondence/${correspondenceId}`, {
      method: "DELETE"
    });
    setUnlinkingId(null);
    router.refresh();
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#cfdbe7] dark:border-slate-800 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold">Correspondence</h3>
        <label className="text-xs font-bold text-primary hover:underline cursor-pointer">
          {isUploading ? "Uploading..." : "+ Add"}
          <input type="file" onChange={handleUpload} disabled={isUploading} className="hidden" />
        </label>
      </div>

      {correspondence.length === 0 ? (
        <p className="text-sm text-[#4c739a] dark:text-slate-400">No correspondence linked yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {correspondence.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-2">
              <a
                href={`/api/projects/${projectId}/correspondence/${item.id}/file`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-sm text-primary hover:underline min-w-0 truncate"
              >
                <span className="material-symbols-outlined text-lg shrink-0">mail</span>
                <span className="truncate">{item.title}</span>
              </a>
              <button
                onClick={() => handleUnlink(item.id)}
                disabled={unlinkingId === item.id}
                className="text-xs font-bold text-red-600 hover:underline disabled:opacity-60 shrink-0"
              >
                {unlinkingId === item.id ? "Unlinking..." : "Unlink"}
              </button>
            </div>
          ))}
        </div>
      )}

      <Link
        href={`/projects/${projectId}/correspondence`}
        className="inline-block mt-3 text-xs font-bold text-[#4c739a] dark:text-slate-400 hover:text-primary"
      >
        View all Correspondence →
      </Link>
    </div>
  );
}
