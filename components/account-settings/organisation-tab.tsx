"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TRADE_PRESETS } from "@/lib/trades";

export function OrganisationTab({ organisation }: { organisation: { id: string; name: string; trade: string | null } }) {
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
  );
}
