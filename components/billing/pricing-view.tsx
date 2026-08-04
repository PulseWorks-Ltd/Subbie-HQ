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
          <h1 className="text-2xl font-black tracking-tight">Simple Pricing That Doesn&apos;t Punish You for Being Busy</h1>
          <p className="text-sm text-[#4c739a] dark:text-slate-400 mt-2 max-w-xl mx-auto">
            Projects, Variations, Site Instructions, photos, correspondence, users — unlimited, on every plan,
            always. The only thing that changes between tiers is your monthly contract review allowance and AI
            drafting allowance, because that&apos;s the part that costs us something to run — we&apos;d rather
            pass the saving to you than charge you for using the software you&apos;re already paying for.
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

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-[#cfdbe7] dark:border-slate-800">
                <th className="text-left font-bold py-2 pr-4"></th>
                <th className="text-left font-bold py-2 px-4">Starter</th>
                <th className="text-left font-bold py-2 px-4">Professional</th>
                <th className="text-left font-bold py-2 px-4">Enterprise</th>
              </tr>
            </thead>
            <tbody className="text-[#4c739a] dark:text-slate-400">
              <tr className="border-b border-[#e7edf3] dark:border-slate-800">
                <td className="py-2 pr-4 font-medium text-[#0d141b] dark:text-slate-50">Price</td>
                <td className="py-2 px-4">$49/mo</td>
                <td className="py-2 px-4">$149/mo</td>
                <td className="py-2 px-4">$249/mo</td>
              </tr>
              <tr className="border-b border-[#e7edf3] dark:border-slate-800">
                <td className="py-2 pr-4 font-medium text-[#0d141b] dark:text-slate-50">
                  Projects, Variations, Site Instructions, Photos, Correspondence
                </td>
                <td className="py-2 px-4">Unlimited</td>
                <td className="py-2 px-4">Unlimited</td>
                <td className="py-2 px-4">Unlimited</td>
              </tr>
              <tr className="border-b border-[#e7edf3] dark:border-slate-800">
                <td className="py-2 pr-4 font-medium text-[#0d141b] dark:text-slate-50">Users</td>
                <td className="py-2 px-4">Unlimited</td>
                <td className="py-2 px-4">Unlimited</td>
                <td className="py-2 px-4">Unlimited</td>
              </tr>
              <tr className="border-b border-[#e7edf3] dark:border-slate-800">
                <td className="py-2 pr-4 font-medium text-[#0d141b] dark:text-slate-50">Mobile app</td>
                <td className="py-2 px-4">✓</td>
                <td className="py-2 px-4">✓</td>
                <td className="py-2 px-4">✓</td>
              </tr>
              <tr className="border-b border-[#e7edf3] dark:border-slate-800">
                <td className="py-2 pr-4 font-medium text-[#0d141b] dark:text-slate-50">Contract Reviews</td>
                <td className="py-2 px-4">1/mo</td>
                <td className="py-2 px-4">2/mo</td>
                <td className="py-2 px-4">4/mo</td>
              </tr>
              <tr className="border-b border-[#e7edf3] dark:border-slate-800">
                <td className="py-2 pr-4 font-medium text-[#0d141b] dark:text-slate-50">
                  Update & email drafting help
                </td>
                <td className="py-2 px-4">Generous</td>
                <td className="py-2 px-4">Higher</td>
                <td className="py-2 px-4">Highest</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-medium text-[#0d141b] dark:text-slate-50">
                  Additional Contract Reviews
                </td>
                <td className="py-2 px-4">$10 each</td>
                <td className="py-2 px-4">$10 each</td>
                <td className="py-2 px-4">$10 each</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-sm italic text-[#4c739a] dark:text-slate-400 text-center">
          14-day free trial on every plan. You&apos;ll know exactly what you&apos;re paying for before you&apos;re
          ever charged.
        </p>
      </div>
    </div>
  );
}
