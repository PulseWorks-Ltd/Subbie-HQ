"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DayWorksSheet } from "@prisma/client";

export function VariationDayWorksSection({
  projectId,
  itemId,
  dayWorksSheets
}: {
  projectId: string;
  itemId: string;
  dayWorksSheets: DayWorksSheet[];
}) {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";

    setIsUploading(true);
    const formData = new FormData();
    formData.set("file", file);
    await fetch(`/api/projects/${projectId}/variation-items/${itemId}/day-works-sheets`, {
      method: "POST",
      body: formData
    });
    setIsUploading(false);
    router.refresh();
  }

  async function handleDelete(sheetId: string) {
    if (!confirm("Delete this day works sheet?")) return;
    await fetch(`/api/projects/${projectId}/variation-items/${itemId}/day-works-sheets/${sheetId}`, {
      method: "DELETE"
    });
    router.refresh();
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#cfdbe7] dark:border-slate-800 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold">Day Works Sheets</h3>
        <label className="text-xs font-bold text-primary hover:underline cursor-pointer">
          {isUploading ? "Uploading..." : "+ Upload"}
          <input type="file" onChange={handleUpload} disabled={isUploading} className="hidden" />
        </label>
      </div>

      {dayWorksSheets.length === 0 ? (
        <p className="text-sm text-[#4c739a] dark:text-slate-400">No day works sheets uploaded yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {dayWorksSheets.map((sheet) => (
            <div key={sheet.id} className="flex items-center justify-between gap-2">
              <a
                href={`/api/projects/${projectId}/variation-items/${itemId}/day-works-sheets/${sheet.id}/file`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-sm text-primary hover:underline min-w-0 truncate"
              >
                <span className="material-symbols-outlined text-lg shrink-0">description</span>
                <span className="truncate">{sheet.fileName}</span>
              </a>
              <button
                onClick={() => handleDelete(sheet.id)}
                className="text-xs font-bold text-red-600 hover:underline shrink-0"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
