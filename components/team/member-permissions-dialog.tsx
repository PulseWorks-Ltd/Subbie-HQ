"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MODULES, MODULE_LABELS, PRESETS, type ModuleKey, type ModulePermissions, type PresetKey } from "@/lib/permissions";
import { formatUserName } from "@/lib/user-display";

type ExistingMember = {
  id: string;
  title: string | null;
  isAdmin: boolean;
  modules: unknown;
  user: { firstName: string | null; lastName: string | null; email: string };
};

export function MemberPermissionsDialog({
  member,
  open,
  onClose
}: {
  member?: ExistingMember | null;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const isEditing = Boolean(member);

  const [email, setEmail] = useState("");
  const [title, setTitle] = useState(member?.title ?? "");
  const [isAdmin, setIsAdmin] = useState(member?.isAdmin ?? false);
  const [modules, setModules] = useState<ModulePermissions>(
    (member?.modules as ModulePermissions | undefined) ?? {}
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) return null;

  function applyPreset(presetKey: PresetKey) {
    const preset = PRESETS[presetKey];
    setTitle(preset.label);
    setIsAdmin(preset.isAdmin);
    setModules(preset.modules);
  }

  function toggleModule(module: ModuleKey) {
    setModules((current) => ({ ...current, [module]: !current[module] }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const body = { title: title || undefined, isAdmin, modules };

    const response = isEditing
      ? await fetch(`/api/organisation/members/${member!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        })
      : await fetch(`/api/organisation/invites`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, email })
        });

    setIsSubmitting(false);

    if (!response.ok) {
      const responseBody = await response.json().catch(() => null);
      setError(typeof responseBody?.error === "string" ? responseBody.error : "Could not save this.");
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
        <h2 className="text-lg font-bold mb-1">{isEditing ? "Edit permissions" : "Invite a team member"}</h2>
        <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-5">
          {isEditing
            ? `${formatUserName(member!.user) ?? member!.user.email} — ${member!.user.email}`
            : "They'll receive an email to set up their account."}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {!isEditing && (
            <label className="flex flex-col gap-1 text-sm font-medium">
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>
          )}

          <label className="flex flex-col gap-1 text-sm font-medium">
            Title <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional, e.g. "Supervisor")</span>
            <input
              type="text"
              value={title ?? ""}
              onChange={(event) => setTitle(event.target.value)}
              className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>

          <div className="flex flex-col gap-1 text-sm font-medium">
            Start from a preset
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PRESETS) as PresetKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyPreset(key)}
                  className="h-8 px-3 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-xs font-bold hover:bg-[#e7edf3] dark:hover:bg-slate-800"
                >
                  {PRESETS[key].label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={isAdmin}
              onChange={(event) => setIsAdmin(event.target.checked)}
              className="size-4 rounded border-[#e7edf3] dark:border-slate-700"
            />
            Admin — full access, can manage the team
          </label>

          {!isAdmin && (
            <div className="flex flex-col gap-1 text-sm font-medium">
              Module access
              <div className="grid grid-cols-2 gap-2 mt-1">
                {MODULES.map((module) => (
                  <label key={module} className="flex items-center gap-2 text-sm font-normal">
                    <input
                      type="checkbox"
                      checked={Boolean(modules[module])}
                      onChange={() => toggleModule(module)}
                      className="size-4 rounded border-[#e7edf3] dark:border-slate-700"
                    />
                    {MODULE_LABELS[module]}
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
              {isSubmitting ? "Saving..." : isEditing ? "Save changes" : "Send invite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
