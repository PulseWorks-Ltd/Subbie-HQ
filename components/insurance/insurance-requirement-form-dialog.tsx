"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { InsuranceRequirementRow } from "@/components/insurance/insurance-view";

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "contract_works", label: "Contract Works" },
  { value: "plant_and_equipment", label: "Plant & Equipment" },
  { value: "public_liability", label: "Public Liability" },
  { value: "motor_vehicle_liability", label: "Motor Vehicle Liability" },
  { value: "professional_indemnity", label: "Professional Indemnity" },
  { value: "other", label: "Other" }
];

function toDateInputValue(date: Date | null) {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

export function InsuranceRequirementFormDialog({
  projectId,
  requirement,
  open,
  onClose
}: {
  projectId: string;
  requirement?: InsuranceRequirementRow | null;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const isEditing = Boolean(requirement);

  const [type, setType] = useState<string>(requirement?.type ?? "public_liability");
  const [label, setLabel] = useState(requirement?.label ?? "");
  const [required, setRequired] = useState(requirement?.required ?? true);
  const [minimumAmount, setMinimumAmount] = useState(
    requirement?.minimumAmount !== null && requirement?.minimumAmount !== undefined ? String(requirement.minimumAmount) : ""
  );
  const [certificateExpiresAt, setCertificateExpiresAt] = useState(toDateInputValue(requirement?.certificateExpiresAt ?? null));
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
      response = await fetch(`/api/projects/${projectId}/insurance-requirements/${requirement!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          required,
          minimumAmount: minimumAmount === "" ? null : Number(minimumAmount),
          certificateExpiresAt: certificateExpiresAt ? new Date(certificateExpiresAt).toISOString() : null
        })
      });
    } else {
      const formData = new FormData();
      formData.set("type", type);
      formData.set("label", label);
      formData.set("required", String(required));
      if (minimumAmount) formData.set("minimumAmount", minimumAmount);
      if (certificateExpiresAt) formData.set("certificateExpiresAt", new Date(certificateExpiresAt).toISOString());
      if (file) formData.set("file", file);

      response = await fetch(`/api/projects/${projectId}/insurance-requirements`, {
        method: "POST",
        body: formData
      });
    }

    setIsSubmitting(false);

    if (!response.ok) {
      const responseBody = await response.json().catch(() => null);
      setError(typeof responseBody?.error === "string" ? responseBody.error : "Could not save this requirement.");
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
        <h2 className="text-lg font-bold mb-1">{isEditing ? "Edit requirement" : "Add insurance requirement"}</h2>
        <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-5">
          {isEditing ? "Update the details for this requirement." : "e.g. Public Liability, minimum $5,000,000."}
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
                {TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="flex flex-col gap-1 text-sm font-medium">
            Label
            <input
              type="text"
              required
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="e.g. Public Liability — minimum $5,000,000"
              className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>

          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={required}
              onChange={(event) => setRequired(event.target.checked)}
              className="size-4 rounded border-[#e7edf3] dark:border-slate-700"
            />
            Required
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Minimum amount <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span>
            <input
              type="number"
              value={minimumAmount}
              onChange={(event) => setMinimumAmount(event.target.value)}
              placeholder="5000000"
              className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Certificate expiry <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span>
            <input
              type="date"
              value={certificateExpiresAt}
              onChange={(event) => setCertificateExpiresAt(event.target.value)}
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
              {isSubmitting ? "Saving..." : isEditing ? "Save changes" : "Add requirement"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
