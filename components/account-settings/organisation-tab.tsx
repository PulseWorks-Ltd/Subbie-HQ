"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TRADE_PRESETS } from "@/lib/trades";
import { PLAN_DISPLAY, type PlanTier } from "@/lib/stripe";

const ACCESS_STATUS_LABEL: Record<string, string> = {
  pilot: "Pilot access",
  trialing: "Free trial",
  active: "Active subscription",
  past_due: "Payment issue",
  canceled: "Subscription canceled",
  none: "Not activated"
};

function BillingSection({
  organisation
}: {
  organisation: {
    accessStatus: string;
    planTier: string | null;
    trialEndsAt: Date | null;
    hasStripeCustomer: boolean;
  };
}) {
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const planLabel = organisation.planTier ? PLAN_DISPLAY[organisation.planTier as PlanTier].label : null;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#cfdbe7] dark:border-slate-800 p-5 flex flex-col gap-3 max-w-lg">
      <h3 className="text-sm font-bold">Billing</h3>

      <div className="text-sm text-[#4c739a] dark:text-slate-400">
        <p>
          Status: <span className="font-medium text-[#0d141c] dark:text-white">{ACCESS_STATUS_LABEL[organisation.accessStatus] ?? organisation.accessStatus}</span>
          {planLabel ? ` — ${planLabel}` : ""}
        </p>
        {organisation.accessStatus === "trialing" && organisation.trialEndsAt && (
          <p className="mt-0.5">
            Trial ends {new Date(organisation.trialEndsAt).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        )}
      </div>

      {organisation.hasStripeCustomer ? (
        <div>
          <button
            onClick={handleOpenPortal}
            disabled={isOpeningPortal}
            className="h-10 px-4 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-bold hover:bg-[#e7edf3] dark:hover:bg-slate-800 disabled:opacity-60"
          >
            {isOpeningPortal ? "Opening..." : "Manage subscription"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-[#4c739a] dark:text-slate-400">
            No Stripe subscription on file — this organisation has pilot access.
          </p>
          <div>
            <Link
              href="/pricing"
              className="inline-flex h-10 items-center px-4 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-bold hover:bg-[#e7edf3] dark:hover:bg-slate-800"
            >
              Upgrade to a paid plan
            </Link>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function OrganisationTab({
  organisation
}: {
  organisation: {
    id: string;
    name: string;
    trade: string | null;
    accessStatus: string;
    planTier: string | null;
    trialEndsAt: Date | null;
    hasStripeCustomer: boolean;
  };
}) {
  const router = useRouter();
  const isPreset = organisation.trade != null && (TRADE_PRESETS as readonly string[]).includes(organisation.trade);

  const [name, setName] = useState(organisation.name);
  const [tradeSelect, setTradeSelect] = useState<string>(
    organisation.trade == null ? "" : isPreset ? organisation.trade : "Other"
  );
  const [customTrade, setCustomTrade] = useState(!isPreset ? organisation.trade ?? "" : "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const trade = tradeSelect === "Other" ? customTrade.trim() || null : tradeSelect || null;

    setIsSaving(true);
    const response = await fetch("/api/organisation", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), trade })
    });
    setIsSaving(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(typeof body?.error === "string" ? body.error : "Could not save.");
      return;
    }

    setSuccessMessage("Organisation updated.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-slate-900 rounded-xl border border-[#cfdbe7] dark:border-slate-800 p-5 flex flex-col gap-4 max-w-lg"
      >
        <h3 className="text-sm font-bold">Organisation</h3>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Organisation name
          <input
            type="text"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Trade <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span>
          <select
            value={tradeSelect}
            onChange={(event) => setTradeSelect(event.target.value)}
            className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">Not set</option>
            {TRADE_PRESETS.map((preset) => (
              <option key={preset} value={preset}>
                {preset}
              </option>
            ))}
            <option value="Other">Other</option>
          </select>
        </label>

        {tradeSelect === "Other" && (
          <label className="flex flex-col gap-1 text-sm font-medium">
            Please specify
            <input
              type="text"
              value={customTrade}
              onChange={(event) => setCustomTrade(event.target.value)}
              className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
        )}

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

      <BillingSection organisation={organisation} />
    </div>
  );
}
