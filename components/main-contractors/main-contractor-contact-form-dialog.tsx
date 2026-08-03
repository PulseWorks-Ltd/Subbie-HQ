"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { MainContractorContact } from "@prisma/client";
import { MAIN_CONTRACTOR_ROLE_PRESETS } from "@/lib/main-contractor-roles";

const OTHER_ROLE = "__other__";

export function MainContractorContactFormDialog({
  mainContractorId,
  contact,
  open,
  onClose
}: {
  mainContractorId: string;
  contact: MainContractorContact | null;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const isPreset = contact?.role ? (MAIN_CONTRACTOR_ROLE_PRESETS as readonly string[]).includes(contact.role) : false;

  const [name, setName] = useState(contact?.name ?? "");
  const [email, setEmail] = useState(contact?.email ?? "");
  const [phone, setPhone] = useState(contact?.phone ?? "");
  const [roleSelect, setRoleSelect] = useState(contact?.role ? (isPreset ? contact.role : OTHER_ROLE) : "");
  const [customRole, setCustomRole] = useState(contact?.role && !isPreset ? contact.role : "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(contact?.name ?? "");
    setEmail(contact?.email ?? "");
    setPhone(contact?.phone ?? "");
    const preset = contact?.role ? (MAIN_CONTRACTOR_ROLE_PRESETS as readonly string[]).includes(contact.role) : false;
    setRoleSelect(contact?.role ? (preset ? contact.role : OTHER_ROLE) : "");
    setCustomRole(contact?.role && !preset ? contact.role : "");
    setError(null);
  }, [open, contact]);

  if (!open) return null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const role = roleSelect === OTHER_ROLE ? customRole : roleSelect;
    const url = contact
      ? `/api/organisation/main-contractors/${mainContractorId}/contacts/${contact.id}`
      : `/api/organisation/main-contractors/${mainContractorId}/contacts`;

    const response = await fetch(url, {
      method: contact ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone, role: role || undefined })
    });

    setIsSubmitting(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(typeof body?.error === "string" ? body.error : "Could not save contact.");
      return;
    }

    onClose();
    router.refresh();
  }

  async function handleDelete() {
    if (!contact) return;
    if (!confirm(`Remove contact "${contact.name}"?`)) return;
    setIsSubmitting(true);
    await fetch(`/api/organisation/main-contractors/${mainContractorId}/contacts/${contact.id}`, { method: "DELETE" });
    setIsSubmitting(false);
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="relative w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 p-6 shadow-lg">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 rounded-lg p-1 text-[#4c739a] hover:bg-[#e7edf3] dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>
        <h2 className="text-lg font-bold mb-4">{contact ? "Edit contact" : "Add contact"}</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Name
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Email <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Phone <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span>
            <input
              type="text"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Role <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span>
            <select
              value={roleSelect}
              onChange={(event) => setRoleSelect(event.target.value)}
              className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">None</option>
              {MAIN_CONTRACTOR_ROLE_PRESETS.map((preset) => (
                <option key={preset} value={preset}>
                  {preset}
                </option>
              ))}
              <option value={OTHER_ROLE}>Other...</option>
            </select>
          </label>

          {roleSelect === OTHER_ROLE && (
            <input
              type="text"
              placeholder="Custom role"
              value={customRole}
              onChange={(event) => setCustomRole(event.target.value)}
              className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 justify-between mt-2">
            {contact ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="text-sm font-bold text-red-600 hover:underline"
              >
                Remove
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-3">
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
                {isSubmitting ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
