"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MainContractor, MainContractorContact, Project } from "@prisma/client";
import { MainContractorContactFormDialog } from "@/components/main-contractors/main-contractor-contact-form-dialog";

type MainContractorDetail = MainContractor & {
  contacts: MainContractorContact[];
  projects: Pick<Project, "id" | "name" | "status" | "jobNumber">[];
};

function formatCurrency(amount: number) {
  return amount.toLocaleString("en-NZ", { style: "currency", currency: "NZD" });
}

export function MainContractorDetailView({
  mainContractor,
  isAdmin,
  totalRetentionWithheld
}: {
  mainContractor: MainContractorDetail;
  isAdmin: boolean;
  totalRetentionWithheld: number;
}) {
  const router = useRouter();
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<MainContractorContact | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [name, setName] = useState(mainContractor.name);
  const [isSavingName, setIsSavingName] = useState(false);

  function openCreateContact() {
    setEditingContact(null);
    setIsContactDialogOpen(true);
  }
  function openEditContact(contact: MainContractorContact) {
    setEditingContact(contact);
    setIsContactDialogOpen(true);
  }

  async function handleSaveName(event: React.FormEvent) {
    event.preventDefault();
    setIsSavingName(true);
    await fetch(`/api/organisation/main-contractors/${mainContractor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });
    setIsSavingName(false);
    setIsEditingName(false);
    router.refresh();
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-6">
      <div>
        <Link href="/main-contractors" className="text-sm text-primary hover:underline">
          &larr; Main Contractors
        </Link>
      </div>

      {isEditingName ? (
        <form onSubmit={handleSaveName} className="flex items-center gap-3">
          <input
            type="text"
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xl font-bold flex-1"
          />
          <button
            type="submit"
            disabled={isSavingName}
            className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setName(mainContractor.name);
              setIsEditingName(false);
            }}
            className="h-10 px-4 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-medium"
          >
            Cancel
          </button>
        </form>
      ) : (
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">{mainContractor.name}</h1>
          {isAdmin && (
            <button
              onClick={() => setIsEditingName(true)}
              className="text-xs font-bold text-primary hover:underline"
            >
              Rename
            </button>
          )}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#cfdbe7] dark:border-slate-800 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold">Contacts</h3>
          {isAdmin && (
            <button onClick={openCreateContact} className="h-8 px-3 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20">
              + Add contact
            </button>
          )}
        </div>
        {mainContractor.contacts.length === 0 ? (
          <p className="text-sm text-[#4c739a] dark:text-slate-400">No contacts yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {mainContractor.contacts.map((contact) => (
              <div
                key={contact.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-[#e7edf3] dark:border-slate-800 p-3"
              >
                <div>
                  <p className="text-sm font-bold">
                    {contact.name}
                    {contact.role && (
                      <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-primary bg-primary/10 rounded px-1.5 py-0.5">
                        {contact.role}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-[#4c739a] dark:text-slate-400">
                    {[contact.email, contact.phone].filter(Boolean).join(" · ") || "No contact details"}
                  </p>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => openEditContact(contact)}
                    className="text-xs font-bold text-primary hover:underline shrink-0"
                  >
                    Edit
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {totalRetentionWithheld > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#cfdbe7] dark:border-slate-800 p-5">
          <h3 className="text-sm font-bold mb-1">Retention currently held</h3>
          <p className="text-xs text-[#4c739a] dark:text-slate-400 mb-2">
            Total, across every project with this Main Contractor — not yet released.
          </p>
          <p className="text-2xl font-bold">{formatCurrency(totalRetentionWithheld)}</p>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#cfdbe7] dark:border-slate-800 p-5">
        <h3 className="text-sm font-bold mb-3">Projects</h3>
        {mainContractor.projects.length === 0 ? (
          <p className="text-sm text-[#4c739a] dark:text-slate-400">No projects linked yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {mainContractor.projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-[#e7edf3] dark:border-slate-800 p-3 hover:border-primary/40"
              >
                <div>
                  <p className="text-sm font-bold">{project.name}</p>
                  {project.jobNumber && (
                    <p className="text-xs text-[#4c739a] dark:text-slate-400">Job #{project.jobNumber}</p>
                  )}
                </div>
                <span className="text-xs font-medium text-[#4c739a] dark:text-slate-400 capitalize">{project.status}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* TODO: surface this Main Contractor's Contract Review comparison
          history here once there's a natural place to show a cross-project
          chain of reviews. */}

      {isAdmin && (
        <MainContractorContactFormDialog
          mainContractorId={mainContractor.id}
          contact={editingContact}
          open={isContactDialogOpen}
          onClose={() => setIsContactDialogOpen(false)}
        />
      )}
    </div>
  );
}
