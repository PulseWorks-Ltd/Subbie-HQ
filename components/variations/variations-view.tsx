"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { VariationItem } from "@prisma/client";
import { VariationItemCard } from "@/components/variations/variation-item-card";
import { VariationItemFormDialog } from "@/components/variations/variation-item-form-dialog";

type FilterKey = "all" | "variation" | "site_instruction";

export function VariationsView({
  projectId,
  items,
  openSiteInstructions,
  canCreateVariation,
  canCreateSiteInstruction
}: {
  projectId: string;
  items: VariationItem[];
  openSiteInstructions: VariationItem[];
  canCreateVariation: boolean;
  canCreateSiteInstruction: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [createType, setCreateType] = useState<"variation" | "site_instruction">(
    canCreateVariation ? "variation" : "site_instruction"
  );

  // "Site Instructions" stays origin-based (an SI that's also become a
  // Variation still belongs there — it's still an SI) while "Variations"
  // now means "carries a Variation identity", not just "originated as one" —
  // an SI-turned-Variation shows up in both, since it's the same record.
  const filteredItems = items.filter((item) => {
    if (filter === "all") return true;
    if (filter === "site_instruction") return item.type === "site_instruction";
    return item.variationCreatedAt != null;
  });

  function openCreateDialog(type: "variation" | "site_instruction") {
    setCreateType(type);
    setIsDialogOpen(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Variations</h2>
          <p className="text-sm text-[#4c739a] dark:text-slate-400">
            Variations and Site Instructions, tracked to completion.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {canCreateVariation && (
            <button
              onClick={() => openCreateDialog("variation")}
              className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90"
            >
              Add Variation
            </button>
          )}
          {canCreateSiteInstruction && (
            <button
              onClick={() => openCreateDialog("site_instruction")}
              className="h-10 px-4 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-bold hover:bg-[#e7edf3] dark:hover:bg-slate-800"
            >
              Add Site Instruction
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 border-b border-[#e7edf3] dark:border-slate-800">
        {([
          ["all", "All"],
          ["variation", "Variations"],
          ["site_instruction", "Site Instructions"]
        ] as [FilterKey, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 text-sm font-bold border-b-2 -mb-px ${
              filter === key
                ? "text-primary border-primary"
                : "text-[#4c739a] dark:text-slate-400 border-transparent hover:text-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#cfdbe7] dark:border-slate-700 py-16">
          <p className="font-bold mb-1">Nothing here yet</p>
          <p className="text-sm text-[#4c739a] dark:text-slate-400">
            Add a Variation or Site Instruction to start tracking it.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => (
            <VariationItemCard key={item.id} projectId={projectId} item={item} />
          ))}
        </div>
      )}

      <VariationItemFormDialog
        projectId={projectId}
        defaultType={createType}
        openSiteInstructions={openSiteInstructions}
        open={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}
