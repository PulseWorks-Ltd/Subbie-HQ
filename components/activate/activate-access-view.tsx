"use client";

import { useState } from "react";
import Link from "next/link";

const STATUS_COPY: Record<string, { heading: string; body: string }> = {
  none: {
    heading: "Activate your access",
    body: "Your organisation hasn't been activated yet. Enter a pilot code, or start a free trial to get going."
  },
  past_due: {
    heading: "Your subscription has an issue",
    body: "The last payment for your subscription didn't go through. Fix your billing details to restore access."
  },
  canceled: {
    heading: "Your subscription has ended",
    body: "Your organisation's subscription was canceled. Start a new plan to get back in, or enter a pilot code."
  }
};

export function ActivateAccessView({
  accessStatus,
  isAdmin,
  organisationName
}: {
  accessStatus: string;
  isAdmin: boolean;
  organisationName: string;
}) {
  const [code, setCode] = useState("");
  const [isSubmittingCode, setIsSubmittingCode] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = STATUS_COPY[accessStatus] ?? STATUS_COPY.none;

  async function handleRedeemCode(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmittingCode(true);

    const response = await fetch("/api/billing/pilot-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code })
    });
    const body = await response.json().catch(() => null);
    setIsSubmittingCode(false);

    if (!response.ok) {
      setError(typeof body?.error === "string" ? body.error : "Could not activate access.");
      return;
    }

    window.location.href = "/";
  }

  async function handleOpenPortal() {
    setError(null);
    setIsOpeningPortal(true);
    const response = await fetch("/api/billing/portal", { method: "POST" });
    const body = await response.json().catch(() => null);
    setIsOpeningPortal(false);

    if (!response.ok) {
      setError(typeof body?.error === "string" ? body.error : "Could not open billing management.");
      return;
    }

    window.location.href = body.url;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/mark-light.png" alt="Subbie HQ" className="size-12 mb-6 dark:hidden" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/mark-dark.png" alt="Subbie HQ" className="size-12 mb-6 hidden dark:block" />

        <h1 className="text-xl font-bold mb-1">{copy.heading}</h1>
        <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-6">
          {copy.body} <span className="font-medium">({organisationName})</span>
        </p>

        {!isAdmin ? (
          <p className="text-sm text-[#4c739a] dark:text-slate-400">
            Ask your organisation admin to activate access for {organisationName}.
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            {accessStatus === "past_due" && (
              <button
                onClick={handleOpenPortal}
                disabled={isOpeningPortal}
                className="h-10 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
              >
                {isOpeningPortal ? "Opening..." : "Manage subscription"}
              </button>
            )}

            {(accessStatus === "none" || accessStatus === "canceled") && (
              <Link
                href="/pricing"
                className="h-10 flex items-center justify-center rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90"
              >
                View plans &amp; start free trial
              </Link>
            )}

            <div className="flex items-center gap-3 text-xs text-[#4c739a] dark:text-slate-400">
              <div className="flex-1 h-px bg-[#e7edf3] dark:bg-slate-800" />
              or enter a pilot code
              <div className="flex-1 h-px bg-[#e7edf3] dark:bg-slate-800" />
            </div>

            <form onSubmit={handleRedeemCode} className="flex flex-col gap-3">
              <input
                type="text"
                required
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Pilot code"
                className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <button
                type="submit"
                disabled={isSubmittingCode}
                className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-bold hover:bg-[#e7edf3] dark:hover:bg-slate-800 disabled:opacity-60"
              >
                {isSubmittingCode ? "Checking..." : "Activate with pilot code"}
              </button>
            </form>

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
