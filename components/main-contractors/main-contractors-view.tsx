"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MainContractor, MainContractorContact, Project } from "@prisma/client";

export type MainContractorRow = MainContractor & {
  contacts: MainContractorContact[];
  projects: Pick<Project, "id" | "status">[];
};

export function MainContractorsView({
  mainContractors,
  isAdmin
}: {
  mainContractors: MainContractorRow[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const response = await fetch("/api/organisation/main-contractors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });

    setIsSubmitting(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(typeof body?.error === "string" ? body.error : "Could not create Main Contractor.");
      return;
    }

    setName("");
    setIsCreating(false);
    router.refresh();
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Main Contractors</h1>
          <p className="text-sm text-[#4c739a] dark:text-slate-400">
            Companies you work for, with their contacts — shared across every project.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setIsCreating(true)}
            className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 shrink-0"
          >
            Add Main Contractor
          </button>
        )}
      </div>

      {isCreating && (
        <form
          onSubmit={handleCreate}
          className="bg-white dark:bg-slate-900 rounded-xl border border-[#cfdbe7] dark:border-slate-800 p-5 flex flex-col gap-3"
        >
          <label className="flex flex-col gap-1 text-sm font-medium">
            Company / trading name
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="h-10 px-4 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
            >
              {isSubmitting ? "Adding..." : "Add"}
            </button>
          </div>
        </form>
      )}

      {mainContractors.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#cfdbe7] dark:border-slate-700 py-16">
          <p className="font-bold mb-1">No Main Contractors yet</p>
          <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-5">
            Add the companies you work for here — you'll assign one to each project.
          </p>
          {isAdmin && (
            <button
              onClick={() => setIsCreating(true)}
              className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90"
            >
              Add Main Contractor
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {mainContractors.map((mc) => {
            const activeProjectCount = mc.projects.filter((p) => p.status === "active").length;
            return (
              <Link
                key={mc.id}
                href={`/main-contractors/${mc.id}`}
                className="bg-white dark:bg-slate-900 rounded-xl border border-[#e7edf3] dark:border-slate-800 p-4 flex items-center justify-between gap-4 hover:border-primary/40"
              >
                <div>
                  <p className="text-sm font-bold">{mc.name}</p>
                  <p className="text-xs text-[#4c739a] dark:text-slate-400">
                    {activeProjectCount} active project{activeProjectCount === 1 ? "" : "s"} · {mc.contacts.length}{" "}
                    contact{mc.contacts.length === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="material-symbols-outlined text-[#4c739a] dark:text-slate-400">chevron_right</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
