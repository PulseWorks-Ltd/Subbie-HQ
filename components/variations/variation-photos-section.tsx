"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { VariationPhoto } from "@prisma/client";

export function VariationPhotosSection({
  projectId,
  itemId,
  photos
}: {
  projectId: string;
  itemId: string;
  photos: VariationPhoto[];
}) {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    event.target.value = "";

    setIsUploading(true);
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    await fetch(`/api/projects/${projectId}/variation-items/${itemId}/photos`, { method: "POST", body: formData });
    setIsUploading(false);
    router.refresh();
  }

  async function handleDelete(photoId: string) {
    if (!confirm("Delete this photo?")) return;
    await fetch(`/api/projects/${projectId}/variation-items/${itemId}/photos/${photoId}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#cfdbe7] dark:border-slate-800 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold">Photos</h3>
        <label className="text-xs font-bold text-primary hover:underline cursor-pointer">
          {isUploading ? "Uploading..." : "+ Upload"}
          <input type="file" accept="image/*" multiple onChange={handleUpload} disabled={isUploading} className="hidden" />
        </label>
      </div>

      {photos.length === 0 ? (
        <p className="text-sm text-[#4c739a] dark:text-slate-400">No photos uploaded yet.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo) => {
            const href = `/api/projects/${projectId}/variation-items/${itemId}/photos/${photo.id}/file`;
            return (
              <div key={photo.id} className="relative group">
                <a href={href} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={href}
                    alt={photo.fileName}
                    className="aspect-square w-full rounded-lg object-cover border border-[#e7edf3] dark:border-slate-800"
                  />
                </a>
                <button
                  onClick={() => handleDelete(photo.id)}
                  className="absolute top-1 right-1 size-6 rounded-full bg-black/60 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
