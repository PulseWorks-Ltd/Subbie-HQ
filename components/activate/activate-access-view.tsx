"use client";

import { useEffect, useRef, useState } from "react";
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

const ACCESS_GRANTED_STATUSES = new Set(["pilot", "trialing", "active"]);
// Stripe's checkout.session.completed / customer.subscription.created
// webhooks are usually near-instant, but are never guaranteed to land
// before the browser's redirect back from Checkout does. ~12s of polling
// covers realistic webhook latency without leaving a genuinely-stuck user
// waiting indefinitely if something did actually go wrong.
const POLL_INTERVAL_MS = 1500;
const MAX_POLL_ATTEMPTS = 8;

export function ActivateAccessView({
  accessStatus,
  isAdmin,
  organisationName,
  justCompletedCheckout
}: {
  accessStatus: string;
  isAdmin: boolean;
  organisationName: string;
  justCompletedCheckout: boolean;
}) {
  const [code, setCode] = useState("");
  const [isSubmittingCode, setIsSubmittingCode] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Task 2 — the webhook-timing fix. Only engages right after a
  // successful Checkout redirect (never on a plain visit to this page),
  // and only while accessStatus genuinely isn't granted yet — the server
  // component already redirects away if it is. Polls this app's own DB
  // (via /api/billing/status) rather than asking Stripe directly, since
  // the webhook remains the actual source of truth (Task 2.3) — this is
  // just waiting for it to have landed, not a second way of deciding access.
  const [isConfirming, setIsConfirming] = useState(justCompletedCheckout);
  const [confirmTimedOut, setConfirmTimedOut] = useState(false);
  const attemptsRef = useRef(0);

  useEffect(() => {
    if (!isConfirming) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    async function poll() {
      attemptsRef.current += 1;
      const response = await fetch("/api/billing/status");
      const body = await response.json().catch(() => null);
      if (cancelled) return;

      if (response.ok && ACCESS_GRANTED_STATUSES.has(body?.accessStatus)) {
        window.location.href = "/";
        return;
      }

      if (attemptsRef.current >= MAX_POLL_ATTEMPTS) {
        setIsConfirming(false);
        setConfirmTimedOut(true);
        return;
      }

      timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
    }

    void poll();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [isConfirming]);

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

  if (isConfirming) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <span className="material-symbols-outlined text-4xl text-primary animate-spin inline-block mb-4">
            progress_activity
          </span>
          <h1 className="text-xl font-bold mb-2">Confirming your subscription...</h1>
          <p className="text-sm text-[#4c739a] dark:text-slate-400">
            Your checkout succeeded — we&apos;re just waiting on final confirmation. This usually takes a few
            seconds.
          </p>
        </div>
      </div>
    );
  }

  const copy = STATUS_COPY[accessStatus] ?? STATUS_COPY.none;

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/mark-light.png" alt="Subbie HQ" className="size-12 mb-6 dark:hidden" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/mark-dark.png" alt="Subbie HQ" className="size-12 mb-6 hidden dark:block" />

        {confirmTimedOut && (
          <p className="text-sm text-amber-600 dark:text-amber-400 mb-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 px-3 py-2">
            Still waiting on confirmation from Stripe for your recent checkout — this can occasionally take a
            minute. Refresh this page shortly, or check back.
          </p>
        )}

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
