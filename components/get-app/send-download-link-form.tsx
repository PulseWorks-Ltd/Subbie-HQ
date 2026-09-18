"use client";

import { useState } from "react";

// Requires a logged-in sender (see app/api/get-app/send-download-link/
// route.ts) — this component is only ever rendered by app/(app)/get-app/
// page.tsx when a session already exists, so there's no client-side
// "please log in" branch to handle here; a stale/expired session just
// surfaces as the route's own 401 via the generic error message below.
export function SendDownloadLinkForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("sending");
    setError(null);

    try {
      const response = await fetch("/api/get-app/send-download-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Couldn't send that link. Please try again.");
      }

      setStatus("sent");
      setEmail("");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Couldn't send that link. Please try again.");
    }
  }

  if (status === "sent") {
    return (
      <div className="w-full text-left bg-white dark:bg-slate-900 border border-[#e7edf3] dark:border-slate-800 rounded-xl p-5 mt-4">
        <p className="text-sm font-bold text-green-700 dark:text-green-400">Link sent!</p>
        <p className="text-sm text-[#4c739a] dark:text-slate-400 mt-1">
          They'll get an email with a link to open on their phone.
        </p>
        <button onClick={() => setStatus("idle")} className="text-sm font-medium text-primary mt-3">
          Send to someone else
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full text-left bg-white dark:bg-slate-900 border border-[#e7edf3] dark:border-slate-800 rounded-xl p-5 mt-4"
    >
      <h2 className="text-sm font-bold mb-1">Send this to a teammate</h2>
      <p className="text-xs text-[#4c739a] dark:text-slate-400 mb-3">
        Email a download link to someone on your team who needs the app on their own phone.
      </p>
      <div className="flex flex-col sm:flex-row items-stretch gap-2">
        <input
          type="email"
          required
          placeholder="teammate@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="flex-1 h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          type="submit"
          disabled={status === "sending"}
          className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
        >
          {status === "sending" ? "Sending..." : "Send Download Link"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </form>
  );
}
