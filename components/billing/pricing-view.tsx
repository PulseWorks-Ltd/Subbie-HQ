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
    <div className="px-4 py-12 sm:py-20">
      <div className="max-w-4xl mx-auto flex flex-col gap-10">
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mark-dark.png" alt="Subbie HQ" className="size-12 mx-auto mb-4" />
          <h1 className="font-heading text-2xl font-extrabold tracking-tight text-on-surface">
            Simple Pricing That Doesn&apos;t Punish You for Being Busy
          </h1>
          <p className="text-sm text-on-surface-variant mt-2 max-w-xl mx-auto">
            Projects, Variations, Site Instructions, photos, correspondence, users — unlimited, on every plan,
            always. The only thing that changes between tiers is your monthly contract review allowance and AI
            drafting allowance, because that&apos;s the part that costs us something to run — we&apos;d rather
            pass the saving to you than charge you for using the software you&apos;re already paying for.
          </p>
        </div>

        {error && <p className="text-sm text-status-error text-center">{error}</p>}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PLAN_TIERS.map((tier) => {
            const plan = PLAN_DISPLAY[tier];
            return (
              <div
                key={tier}
                className="flex flex-col gap-4 rounded-xl border border-white/5 bg-surface-card p-6 shadow-[0_10px_30px_rgba(0,0,0,0.4)]"
              >
                <div>
                  <h2 className="font-heading text-lg font-bold text-on-surface">{plan.label}</h2>
                  <p className="font-heading text-3xl font-extrabold text-on-surface mt-1">
                    ${plan.priceUsd}
                    <span className="text-sm font-medium text-on-surface-variant"> / month</span>
                  </p>
                </div>
                <p className="text-sm text-on-surface-variant flex-1">{plan.description}</p>

                {!isLoggedIn ? (
                  <Link
                    href="/signup"
                    className="h-10 flex items-center justify-center rounded-lg bg-accent-electric text-white text-sm font-bold hover:shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all active:scale-95"
                  >
                    Start free trial
                  </Link>
                ) : isAdmin ? (
                  <button
                    onClick={() => startTrial(tier)}
                    disabled={startingTier !== null}
                    className="h-10 rounded-lg bg-accent-electric text-white text-sm font-bold hover:shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all active:scale-95 disabled:opacity-60"
                  >
                    {startingTier === tier ? "Starting..." : "Start free trial"}
                  </button>
                ) : (
                  <p className="text-xs text-center text-on-surface-variant">
                    Ask your organisation admin to start a plan.
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/5 bg-surface-card p-2">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left font-bold py-2 pr-4 px-2 text-on-surface"></th>
                <th className="text-left font-bold py-2 px-4 text-on-surface">Starter</th>
                <th className="text-left font-bold py-2 px-4 text-on-surface">Professional</th>
                <th className="text-left font-bold py-2 px-4 text-on-surface">Enterprise</th>
              </tr>
            </thead>
            <tbody className="text-on-surface-variant">
              <tr className="border-b border-white/5">
                <td className="py-2 pr-4 px-2 font-medium text-on-surface">Price</td>
                <td className="py-2 px-4">$49/mo</td>
                <td className="py-2 px-4">$149/mo</td>
                <td className="py-2 px-4">$249/mo</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 pr-4 px-2 font-medium text-on-surface">
                  Projects, Variations, Site Instructions, Photos, Correspondence
                </td>
                <td className="py-2 px-4">Unlimited</td>
                <td className="py-2 px-4">Unlimited</td>
                <td className="py-2 px-4">Unlimited</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 pr-4 px-2 font-medium text-on-surface">Users</td>
                <td className="py-2 px-4">Unlimited</td>
                <td className="py-2 px-4">Unlimited</td>
                <td className="py-2 px-4">Unlimited</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 pr-4 px-2 font-medium text-on-surface">Mobile app</td>
                <td className="py-2 px-4">✓</td>
                <td className="py-2 px-4">✓</td>
                <td className="py-2 px-4">✓</td>
              </tr>
              {/*
                Directional wording, not specific numbers — no usage-limit
                enforcement exists yet (see lib/ai-usage.ts). The intended
                real values once that's built are Starter 1/mo,
                Professional 2/mo, Enterprise 4/mo — implement the limit
                and restore these exact numbers here in the same change,
                not the copy alone.
              */}
              <tr className="border-b border-white/5">
                <td className="py-2 pr-4 px-2 font-medium text-on-surface">Contract Reviews</td>
                <td className="py-2 px-4">Includes monthly contract reviews</td>
                <td className="py-2 px-4">More contract reviews included</td>
                <td className="py-2 px-4">Highest contract review allowance</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 pr-4 px-2 font-medium text-on-surface">
                  Update & email drafting help
                </td>
                <td className="py-2 px-4">Generous</td>
                <td className="py-2 px-4">Higher</td>
                <td className="py-2 px-4">Highest</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 px-2 font-medium text-on-surface">
                  Additional Contract Reviews
                </td>
                <td className="py-2 px-4">$10 each</td>
                <td className="py-2 px-4">$10 each</td>
                <td className="py-2 px-4">$10 each</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-sm italic text-on-surface-variant text-center">
          14-day free trial on every plan. You&apos;ll know exactly what you&apos;re paying for before you&apos;re
          ever charged.
        </p>
      </div>
    </div>
  );
}
