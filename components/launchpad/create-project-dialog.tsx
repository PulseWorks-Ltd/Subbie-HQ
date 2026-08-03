"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { MainContractor, MainContractorContact } from "@prisma/client";

type MainContractorOption = MainContractor & { contacts: MainContractorContact[] };

const NEW_MC_VALUE = "__new__";

export function CreateProjectDialog({
  open,
  onClose
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [jobNumber, setJobNumber] = useState("");
  const [mainContractors, setMainContractors] = useState<MainContractorOption[]>([]);
  const [selectedMainContractorId, setSelectedMainContractorId] = useState("");
  const [newMainContractorName, setNewMainContractorName] = useState("");
  const [activeContactIds, setActiveContactIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setCode("");
    setJobNumber("");
    setSelectedMainContractorId("");
    setNewMainContractorName("");
    setActiveContactIds([]);
    setError(null);

    fetch("/api/organisation/main-contractors")
      .then((response) => (response.ok ? response.json() : { mainContractors: [] }))
      .then((body) => setMainContractors(body.mainContractors ?? []));
  }, [open]);

  if (!open) return null;

  const selectedMainContractor = mainContractors.find((mc) => mc.id === selectedMainContractorId);

  function toggleContact(contactId: string) {
    setActiveContactIds((current) =>
      current.includes(contactId) ? current.filter((id) => id !== contactId) : [...current, contactId]
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!selectedMainContractorId && !newMainContractorName.trim()) {
      setError("Select an existing Main Contractor, or enter a name to create a new one.");
      return;
    }

    setIsSubmitting(true);
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        code: code || undefined,
        jobNumber: jobNumber || undefined,
        mainContractorId: selectedMainContractorId === NEW_MC_VALUE ? undefined : selectedMainContractorId || undefined,
        newMainContractorName:
          selectedMainContractorId === NEW_MC_VALUE || !selectedMainContractorId ? newMainContractorName || undefined : undefined,
        activeContactIds
      })
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const message = typeof body?.error === "string" ? body.error : null;
      setError(message ?? "Could not create the project.");
      return;
    }

    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="relative w-full max-w-md rounded-xl bg-white dark:bg-slate-900 p-6 shadow-lg max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 rounded-lg p-1 text-[#4c739a] hover:bg-[#e7edf3] dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>
        <h2 className="text-lg font-bold mb-1">Start a new project</h2>
        <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-5">
          You can add contract, scope and programme details once it's created.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Project name
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Project code <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span>
              <input
                type="text"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Job number <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span>
              <input
                type="text"
                value={jobNumber}
                onChange={(event) => setJobNumber(event.target.value)}
                className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Main Contractor
            <select
              required
              value={selectedMainContractorId}
              onChange={(event) => {
                setSelectedMainContractorId(event.target.value);
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
              <option value={NEW_MC_VALUE}>+ New Main Contractor...</option>
            </select>
          </label>

          {selectedMainContractorId === NEW_MC_VALUE && (
            <input
              type="text"
              required
              placeholder="New Main Contractor name"
              value={newMainContractorName}
              onChange={(event) => setNewMainContractorName(event.target.value)}
              className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          )}

          {selectedMainContractor && selectedMainContractor.contacts.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium">
                Active contacts for this project{" "}
                <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span>
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
              {isSubmitting ? "Creating..." : "Create project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
