"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { formatUserName } from "@/lib/user-display";

export function MySettingsTab({
  user
}: {
  user: { id: string; firstName: string | null; lastName: string | null; jobTitle: string | null; email: string };
}) {
  const router = useRouter();
  const { update } = useSession();

  const [firstName, setFirstName] = useState(user.firstName ?? "");
  const [lastName, setLastName] = useState(user.lastName ?? "");
  const [jobTitle, setJobTitle] = useState(user.jobTitle ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (newPassword && newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }
    if (newPassword && !currentPassword) {
      setError("Enter your current password to set a new one.");
      return;
    }

    setIsSaving(true);
    const response = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        jobTitle: jobTitle.trim() || undefined,
        currentPassword: newPassword ? currentPassword : undefined,
        newPassword: newPassword || undefined
      })
    });
    setIsSaving(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(typeof body?.error === "string" ? body.error : "Could not save your settings.");
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSuccessMessage("Settings saved.");

    // Keeps the header/account menu's cached session name in sync
    // immediately, without requiring a re-login (see auth.ts's jwt callback
    // handling trigger === "update").
    await update({ name: formatUserName({ firstName, lastName }) ?? user.email });
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-slate-900 rounded-xl border border-[#cfdbe7] dark:border-slate-800 p-5 flex flex-col gap-4 max-w-lg"
    >
      <h3 className="text-sm font-bold">Profile</h3>

      <div className="flex gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium flex-1">
          First name
          <input
            type="text"
            required
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium flex-1">
          Surname
          <input
            type="text"
            required
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Job title <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span>
        <input
          type="text"
          value={jobTitle}
          onChange={(event) => setJobTitle(event.target.value)}
          className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Email
        <input
          type="email"
          value={user.email}
          disabled
          className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-[#f6f7f8] dark:bg-slate-800/60 px-3 text-sm text-[#4c739a] dark:text-slate-400"
        />
        <span className="text-xs text-[#4c739a] dark:text-slate-400">Your email is your login and can't be changed here.</span>
      </label>

      <div className="border-t border-[#e7edf3] dark:border-slate-800 pt-4 flex flex-col gap-3">
        <h3 className="text-sm font-bold">
          Change password <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span>
        </h3>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Current password
          <input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>
        <div className="flex gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium flex-1">
            New password
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium flex-1">
            Confirm new password
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {successMessage && <p className="text-sm text-green-600 dark:text-green-400">{successMessage}</p>}

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
