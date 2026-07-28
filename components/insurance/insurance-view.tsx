"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { InsuranceRequirement } from "@prisma/client";
import { InsuranceRequirementCard } from "@/components/insurance/insurance-requirement-card";
import { InsuranceRequirementFormDialog } from "@/components/insurance/insurance-requirement-form-dialog";

export type InsuranceRequirementRow = Omit<InsuranceRequirement, "minimumAmount"> & { minimumAmount: number | null };

export function InsuranceView({
  projectId,
  insuranceRequirements
}: {
  projectId: string;
  insuranceRequirements: InsuranceRequirementRow[];
}) {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRequirement, setEditingRequirement] = useState<InsuranceRequirementRow | null>(null);

  const needsReviewCount = insuranceRequirements.filter((r) => r.status === "parsed").length;

  function openCreateDialog() {
    setEditingRequirement(null);
    setIsDialogOpen(true);
  }

  function openEditDialog(requirement: InsuranceRequirementRow) {
    setEditingRequirement(requirement);
    setIsDialogOpen(true);
  }

  async function handleDelete(requirement: InsuranceRequirementRow) {
    if (!confirm(`Delete "${requirement.label}"?`)) return;
    await fetch(`/api/projects/${projectId}/insurance-requirements/${requirement.id}`, { method: "DELETE" });
    router.refresh();
  }

  async function handleConfirm(requirement: InsuranceRequirementRow) {
    await fetch(`/api/projects/${projectId}/insurance-requirements/${requirement.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmSuggested: true })
    });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Insurance</h2>
          <p className="text-sm text-[#4c739a] dark:text-slate-400">
            Insurance requirements for this project, and evidence of your own cover against them.
          </p>
        </div>
        <button
          onClick={openCreateDialog}
          className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 shrink-0"
        >
          Add Requirement
        </button>
      </div>

      {needsReviewCount > 0 && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20 px-4 py-2 text-sm text-amber-800 dark:text-amber-300">
          {needsReviewCount} requirement{needsReviewCount === 1 ? "" : "s"} suggested from a Contract Review — awaiting
          confirmation.
        </div>
      )}

      {insuranceRequirements.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#cfdbe7] dark:border-slate-700 py-16">
          <p className="font-bold mb-1">No insurance requirements yet</p>
          <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-5">
            Add them manually, or run a Contract Review on the Contract tab to suggest them from the subcontract.
          </p>
          <button
            onClick={openCreateDialog}
            className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90"
          >
            Add Requirement
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insuranceRequirements.map((requirement) => (
            <InsuranceRequirementCard
              key={requirement.id}
              requirement={requirement}
              projectId={projectId}
              onEdit={() => openEditDialog(requirement)}
              onDelete={() => handleDelete(requirement)}
              onConfirm={() => handleConfirm(requirement)}
            />
          ))}
        </div>
      )}

      <InsuranceRequirementFormDialog
        projectId={projectId}
        requirement={editingRequirement}
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
      />
    </div>
  );
}
