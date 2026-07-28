"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { INSURANCE_TYPE_LABELS } from "@/lib/insurance-labels";
import type { InsuranceCertificateRow } from "@/components/insurance/insurance-certificates-view";

function toDateInputValue(date: Date | null) {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

export function InsuranceCertificateFormDialog({
  certificate,
  open,
  onClose
}: {
  certificate?: InsuranceCertificateRow | null;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const isEditing = Boolean(certificate);

  const [type, setType] = useState<string>(certificate?.type ?? "public_liability");
  const [provider, setProvider] = useState(certificate?.provider ?? "");
  const [policyNumber, setPolicyNumber] = useState(certificate?.policyNumber ?? "");
  const [expiryAt, setExpiryAt] = useState(toDateInputValue(certificate?.expiryAt ?? null));
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) return null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    let response: Response;
    if (isEditing) {
      response = await fetch(`/api/organisation/insurance-certificates/${certificate!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          policyNumber: policyNumber || null,
          expiryAt: expiryAt ? new Date(expiryAt).toISOString() : null
        })
      });
    } else {
      const formData = new FormData();
      formData.set("type", type);
      formData.set("provider", provider);
      if (policyNumber) formData.set("policyNumber", policyNumber);
      if (expiryAt) formData.set("expiryAt", new Date(expiryAt).toISOString());
      if (file) formData.set("file", file);

      response = await fetch("/api/organisation/insurance-certificates", {
        method: "POST",
        body: formData
      });
    }

    setIsSubmitting(false);

    if (!response.ok) {
      const responseBody = await response.json().catch(() => null);
      setError(typeof responseBody?.error === "string" ? responseBody.error : "Could not save this certificate.");
      return;
    }

    onClose();
    router.refresh();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 p-6 shadow-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold mb-1">{isEditing ? "Edit certificate" : "Add insurance certificate"}</h2>
        <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-5">
          {isEditing ? "Update the details for this certificate." : "This applies across every project — add it once."}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {!isEditing && (
            <label className="flex flex-col gap-1 text-sm font-medium">
              Type
              <select
                value={type}
                onChange={(event) => setType(event.target.value)}
                className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {Object.entries(INSURANCE_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="flex flex-col gap-1 text-sm font-medium">
            Provider
            <input
              type="text"
              required
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
              placeholder="e.g. Vero, AA Insurance"
              className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Policy number <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span>
            <input
              type="text"
              value={policyNumber ?? ""}
              onChange={(event) => setPolicyNumber(event.target.value)}
              className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Expiry date <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span>
            <input
              type="date"
              value={expiryAt}
              onChange={(event) => setExpiryAt(event.target.value)}
              className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>

          {!isEditing && (
            <label className="flex flex-col gap-1 text-sm font-medium">
              Certificate file <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span>
              <input
                type="file"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="text-sm file:mr-2 file:h-9 file:px-3 file:rounded-lg file:border-0 file:bg-primary/10 file:text-primary file:font-bold file:text-xs"
              />
            </label>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 justify-end mt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
            >
              {isSubmitting ? "Saving..." : isEditing ? "Save changes" : "Add certificate"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
