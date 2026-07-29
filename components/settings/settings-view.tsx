"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ContractTerms, RiskLevel } from "@prisma/client";
import { ContractTermsSection } from "@/components/settings/contract-terms-section";
import { MainContractorSection } from "@/components/settings/main-contractor-section";

export function SettingsView({
  projectId,
  riskLevel: initialRiskLevel,
  invoiceModeEnabled: initialInvoiceModeEnabled,
  contractTerms
}: {
  projectId: string;
  riskLevel: RiskLevel;
  invoiceModeEnabled: boolean;
  contractTerms: ContractTerms | null;
}) {
  const router = useRouter();
  const [riskLevel, setRiskLevel] = useState<RiskLevel>(initialRiskLevel);
  const [invoiceModeEnabled, setInvoiceModeEnabled] = useState(initialInvoiceModeEnabled);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSaveProject(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    await fetch(`/api/projects/${projectId}/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ riskLevel, invoiceModeEnabled })
    });
    setIsSaving(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-bold">Settings</h2>
        <p className="text-sm text-[#4c739a] dark:text-slate-400">Project configuration and contract-derived reference data.</p>
      </div>

      <form
        onSubmit={handleSaveProject}
        className="bg-white dark:bg-slate-900 rounded-xl border border-[#cfdbe7] dark:border-slate-800 p-5 flex flex-col gap-4"
      >
        <h3 className="text-sm font-bold">Project</h3>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Risk level
          <select
            value={riskLevel}
            onChange={(event) => setRiskLevel(event.target.value as RiskLevel)}
            className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={invoiceModeEnabled}
            onChange={(event) => setInvoiceModeEnabled(event.target.checked)}
            className="size-4 rounded border-[#e7edf3] dark:border-slate-700"
          />
          Invoice mode enabled
        </label>

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

      <MainContractorSection projectId={projectId} />

      <ContractTermsSection projectId={projectId} contractTerms={contractTerms} />
    </div>
  );
}
