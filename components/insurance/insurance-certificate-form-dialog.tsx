"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { INSURANCE_TYPE_LABELS } from "@/lib/insurance-labels";
import { INSURANCE_COVER_TYPE_PRESETS } from "@/lib/insurance-cover-types";
import type { InsuranceCertificateRow } from "@/components/insurance/insurance-certificates-view";

function toDateInputValue(date: Date | null) {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

type CoverEntry = { coverType: string; value: string };

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
  const [covers, setCovers] = useState<CoverEntry[]>(
    certificate?.covers.map((c) => ({ coverType: c.coverType, value: String(c.value) })) ?? []
  );
  const [file, setFile] = useState<File | null>(null);
  const [parsedFile, setParsedFile] = useState<{ fileName: string; storageKey: string } | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseNotice, setParseNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) return null;

  function addCover() {
    setCovers((current) => [...current, { coverType: INSURANCE_COVER_TYPE_PRESETS[0], value: "" }]);
  }
  function updateCover(index: number, field: keyof CoverEntry, value: string) {
    setCovers((current) => current.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  }
  function removeCover(index: number) {
    setCovers((current) => current.filter((_, i) => i !== index));
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setParsedFile(null);
    setParseNotice(null);
    if (!selected) return;

    setIsParsing(true);
    const formData = new FormData();
    formData.set("file", selected);
    const response = await fetch("/api/organisation/insurance-certificates/parse", { method: "POST", body: formData });
    const body = await response.json().catch(() => null);
    setIsParsing(false);

    if (!body?.storageKey) {
      setParseNotice("Could not upload this file. You can still fill the details in manually.");
      return;
    }
    setParsedFile({ fileName: body.fileName, storageKey: body.storageKey });

    if (!response.ok) {
      setParseNotice(typeof body?.error === "string" ? body.error : "Could not read this document automatically. Fill the details in manually.");
      return;
    }

    const extracted = body.extracted as {
      provider: string | null;
      policyNumber: string | null;
      expiryDate: string | null;
      covers: { coverType: string; value: number }[];
    };
    if (extracted.provider) setProvider(extracted.provider);
    if (extracted.policyNumber) setPolicyNumber(extracted.policyNumber);
    if (extracted.expiryDate) setExpiryAt(extracted.expiryDate);
    if (extracted.covers.length > 0) {
      setCovers(extracted.covers.map((c) => ({ coverType: c.coverType, value: String(c.value) })));
    }
    setParseNotice(
      "Fields below were extracted automatically from the file — review and correct anything before saving."
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const validCovers = covers
      .filter((c) => c.coverType.trim() && c.value.trim())
      .map((c) => ({ coverType: c.coverType.trim(), value: Number(c.value) }));

    const formData = new FormData();
    formData.set("provider", provider);
    formData.set("policyNumber", policyNumber || "");
    formData.set("expiryAt", expiryAt ? new Date(expiryAt).toISOString() : "");
    formData.set("covers", JSON.stringify(validCovers));
    if (parsedFile) {
      formData.set("fileName", parsedFile.fileName);
      formData.set("storageKey", parsedFile.storageKey);
    } else if (file) {
      formData.set("file", file);
    }

    let response: Response;
    if (isEditing) {
      response = await fetch(`/api/organisation/insurance-certificates/${certificate!.id}`, {
        method: "PATCH",
        body: formData
      });
    } else {
      formData.set("type", type);
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
          <label className="flex flex-col gap-1 text-sm font-medium">
            Certificate file <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional — PDF fields are extracted automatically)</span>
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              disabled={isParsing}
              className="text-sm file:mr-2 file:h-9 file:px-3 file:rounded-lg file:border-0 file:bg-primary/10 file:text-primary file:font-bold file:text-xs"
            />
          </label>

          {isParsing && <p className="text-sm text-[#4c739a] dark:text-slate-400">Reading document...</p>}
          {parseNotice && !isParsing && <p className="text-sm text-amber-600 dark:text-amber-400">{parseNotice}</p>}

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

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Cover types &amp; values <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span></p>
              <button
                type="button"
                onClick={addCover}
                className="text-xs font-bold text-primary hover:underline"
              >
                + Add cover
              </button>
            </div>
            {covers.map((cover, index) => (
              <div key={index} className="flex gap-2 items-center">
                <input
                  type="text"
                  list="cover-type-presets"
                  value={cover.coverType}
                  onChange={(event) => updateCover(index, "coverType", event.target.value)}
                  placeholder="Cover type"
                  className="h-9 flex-1 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <input
                  type="number"
                  min="0"
                  value={cover.value}
                  onChange={(event) => updateCover(index, "value", event.target.value)}
                  placeholder="Value $"
                  className="h-9 w-32 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <button type="button" onClick={() => removeCover(index)} className="text-red-600 text-xs font-bold shrink-0">
                  Remove
                </button>
              </div>
            ))}
            <datalist id="cover-type-presets">
              {INSURANCE_COVER_TYPE_PRESETS.map((preset) => (
                <option key={preset} value={preset} />
              ))}
            </datalist>
          </div>

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
              disabled={isSubmitting || isParsing}
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
