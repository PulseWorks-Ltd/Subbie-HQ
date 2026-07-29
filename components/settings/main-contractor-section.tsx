"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { MainContractor, MainContractorContact } from "@prisma/client";

type MainContractorOption = MainContractor & { contacts: MainContractorContact[] };

export function MainContractorSection({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [jobNumber, setJobNumber] = useState("");
  const [mainContractorId, setMainContractorId] = useState("");
  const [activeContactIds, setActiveContactIds] = useState<string[]>([]);
  const [mainContractors, setMainContractors] = useState<MainContractorOption[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/main-contractor`)
      .then((response) => response.json())
      .then((body) => {
        setJobNumber(body.jobNumber ?? "");
        setMainContractorId(body.mainContractorId ?? "");
        setActiveContactIds(body.activeContactIds ?? []);
        setMainContractors(body.mainContractors ?? []);
        setIsLoading(false);
      });
  }, [projectId]);

  const selectedMainContractor = mainContractors.find((mc) => mc.id === mainContractorId);

  function toggleContact(contactId: string) {
    setActiveContactIds((current) =>
      current.includes(contactId) ? current.filter((id) => id !== contactId) : [...current, contactId]
    );
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!mainContractorId) {
      setError("Select a Main Contractor.");
      return;
    }
    setIsSaving(true);
    const response = await fetch(`/api/projects/${projectId}/main-contractor`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mainContractorId, jobNumber: jobNumber || undefined, activeContactIds })
    });
    setIsSaving(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(typeof body?.error === "string" ? body.error : "Could not save.");
      return;
    }
    router.refresh();
  }

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#cfdbe7] dark:border-slate-800 p-5">
        <p className="text-sm text-[#4c739a] dark:text-slate-400">Loading...</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSave}
      className="bg-white dark:bg-slate-900 rounded-xl border border-[#cfdbe7] dark:border-slate-800 p-5 flex flex-col gap-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">Main Contractor</h3>
        <Link href="/main-contractors" className="text-xs font-bold text-primary hover:underline">
          Manage Main Contractors
        </Link>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Job number <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span>
        <input
          type="text"
          value={jobNumber}
          onChange={(event) => setJobNumber(event.target.value)}
          className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Main Contractor
        <select
          value={mainContractorId}
          onChange={(event) => {
            setMainContractorId(event.target.value);
            setActiveContactIds([]);
          }}
          className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="" disabled>
            Select...
          </option>
          {mainContractors.map((mc) => (
            <option key={mc.id} value={mc.id}>
              {mc.name}
            </option>
          ))}
        </select>
      </label>

      {selectedMainContractor && selectedMainContractor.contacts.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium">
            Active contacts for this project <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span>
          </p>
          <div className="flex flex-col gap-1 rounded-lg border border-[#e7edf3] dark:border-slate-700 p-2">
            {selectedMainContractor.contacts.map((contact) => (
              <label key={contact.id} className="flex items-center gap-2 text-sm px-1 py-1">
                <input
                  type="checkbox"
                  checked={activeContactIds.includes(contact.id)}
                  onChange={() => toggleContact(contact.id)}
                  className="size-4 rounded border-[#e7edf3] dark:border-slate-700"
                />
                {contact.name}
                {contact.role && <span className="text-xs text-[#4c739a] dark:text-slate-400">({contact.role})</span>}
              </label>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div>
        <button
          type="submit"
          disabled={isSaving}
          className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}
