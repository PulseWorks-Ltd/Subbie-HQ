"use client";

import { useState } from "react";
import Link from "next/link";
import { PLAN_TIERS, PLAN_DISPLAY, type PlanTier } from "@/lib/stripe";

export function PricingView({ isLoggedIn, isAdmin }: { isLoggedIn: boolean; isAdmin: boolean }) {
  const [startingTier, setStartingTier] = useState<PlanTier | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startTrial(tier: PlanTier) {
    setError(null);
    setStartingTier(tier);
    const response = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier })
    });
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      setStartingTier(null);
      setError(typeof body?.error === "string" ? body.error : "Could not start checkout. Please try again.");
      return;
    }

    window.location.href = body.url;
  }

  return (
    <div className="min-h-screen px-4 py-12">
      <div className="max-w-4xl mx-auto flex flex-col gap-10">
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mark-light.png" alt="Subbie HQ" className="size-12 mx-auto mb-4 dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mark-dark.png" alt="Subbie HQ" className="size-12 mx-auto mb-4 hidden dark:block" />
          <h1 className="text-2xl font-black tracking-tight">Simple, per-organisation pricing</h1>
          <p className="text-sm text-[#4c739a] dark:text-slate-400 mt-1">
            Unlimited users on every plan. 14-day free trial, no charge until it ends.
          </p>
        </div>

        {error && <p className="text-sm text-red-600 text-center">{error}</p>}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PLAN_TIERS.map((tier) => {
            const plan = PLAN_DISPLAY[tier];
            return (
              <div
                key={tier}
                className="flex flex-col gap-4 rounded-xl border border-[#cfdbe7] dark:border-slate-800 bg-white dark:bg-slate-900 p-6"
              >
                <div>
                  <h2 className="text-lg font-bold">{plan.label}</h2>
                  <p className="text-3xl font-black mt-1">
                    ${plan.priceUsd}
                    <span className="text-sm font-medium text-[#4c739a] dark:text-slate-400"> / month</span>
                  </p>
                </div>
                <p className="text-sm text-[#4c739a] dark:text-slate-400 flex-1">{plan.description}</p>

                {!isLoggedIn ? (
                  <Link
                    href="/signup"
                    className="h-10 flex items-center justify-center rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90"
                  >
                    Start free trial
                  </Link>
                ) : isAdmin ? (
                  <button
                    onClick={() => startTrial(tier)}
                    disabled={startingTier !== null}
                    className="h-10 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
                  >
                    {startingTier === tier ? "Starting..." : "Start free trial"}
                  </button>
                ) : (
                  <p className="text-xs text-center text-[#4c739a] dark:text-slate-400">
                    Ask your organisation admin to start a plan.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
