"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ItemWithComponents, ScheduleWithItems } from "@/lib/contract-schedule";
import { ContractItemFormDialog } from "@/components/contract-schedule/contract-item-form-dialog";
import { ExtractQuoteDialog } from "@/components/contract-schedule/extract-quote-dialog";
import { ProgressCheckpointEditor } from "@/components/contract-schedule/progress-checkpoint-editor";

function formatCurrency(amount: number) {
  return amount.toLocaleString("en-NZ", { style: "currency", currency: "NZD" });
}

type ComputedComponent = {
  componentId: string;
  currentPercent: number | null;
  claimedToDate: number;
  phasePercents?: { phaseId: string; percent: number }[];
};
type ComputedItem = { itemId: string; components: ComputedComponent[] };

export function ContractScheduleView({
  projectId,
  projectName,
  schedule,
  totalValue,
  computed
}: {
  projectId: string;
  projectName: string;
  schedule: ScheduleWithItems | null;
  totalValue: number;
  computed: ComputedItem[];
}) {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isExtractDialogOpen, setIsExtractDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemWithComponents | null>(null);
  const [defaultErect, setDefaultErect] = useState(schedule?.defaultErectPercent != null ? String(schedule.defaultErectPercent) : "70");
  const [defaultDismantle, setDefaultDismantle] = useState(
    schedule?.defaultDismantlePercent != null ? String(schedule.defaultDismantlePercent) : "30"
  );
  const [isSavingDefaults, setIsSavingDefaults] = useState(false);

  const items = schedule?.items ?? [];
  const computedByItemId = new Map(computed.map((entry) => [entry.itemId, entry]));

  function openCreateDialog() {
    setEditingItem(null);
    setIsDialogOpen(true);
  }
  function openEditDialog(item: ItemWithComponents) {
    setEditingItem(item);
    setIsDialogOpen(true);
  }
  async function handleDelete(item: ItemWithComponents) {
    if (!confirm(`Delete contract item "${item.description}"? This removes all its progress history too.`)) return;
    await fetch(`/api/projects/${projectId}/contract-schedule/items/${item.id}`, { method: "DELETE" });
    router.refresh();
  }

  async function saveDefaults() {
    setIsSavingDefaults(true);
    await fetch(`/api/projects/${projectId}/contract-schedule`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultErectPercent: Number(defaultErect) || 0, defaultDismantlePercent: Number(defaultDismantle) || 0 })
    });
    setIsSavingDefaults(false);
    router.refresh();
  }

  // Groups are purely organisational (matching how a real quote lays out
  // elevations/sections) — items with no sectionLabel fall into one
  // unlabelled group, rendered first.
  const groups = new Map<string, ItemWithComponents[]>();
  for (const item of items) {
    const key = item.sectionLabel ?? "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Contract Schedule</h2>
          <p className="text-sm text-[#4c739a] dark:text-slate-400">
            The priced scope of work for {projectName || "this project"} — every line, and what's claimable against it so far.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setIsExtractDialogOpen(true)}
            className="h-10 px-4 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-bold hover:bg-[#f8fafc] dark:hover:bg-slate-800"
          >
            Extract from Quote
          </button>
          <button onClick={openCreateDialog} className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90">
            Add Contract Item
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-6 rounded-xl border border-[#e7edf3] dark:border-slate-700 p-4">
        <div>
          <p className="text-xs text-[#4c739a] dark:text-slate-400">Original Subcontract Sum</p>
          <p className="text-xl font-bold">{formatCurrency(totalValue)}</p>
        </div>
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium">
            Default Erect %
            <input
              type="number"
              min={0}
              max={100}
              value={defaultErect}
              onChange={(event) => setDefaultErect(event.target.value)}
              className="h-8 w-20 rounded-md border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium">
            Default Dismantle %
            <input
              type="number"
              min={0}
              max={100}
              value={defaultDismantle}
              onChange={(event) => setDefaultDismantle(event.target.value)}
              className="h-8 w-20 rounded-md border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs"
            />
          </label>
          <button
            onClick={saveDefaults}
            disabled={isSavingDefaults}
            className="h-8 px-3 rounded-md border border-[#e7edf3] dark:border-slate-700 text-xs font-medium disabled:opacity-60"
          >
            {isSavingDefaults ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#cfdbe7] dark:border-slate-700 py-16">
          <p className="font-bold mb-1">No contract items yet</p>
          <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-5">
            Add each priced line from the subbie's quote — Supply, Install, Erect &amp; Dismantle, Transport, Weekly Hire, whatever it
            was actually priced with.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setIsExtractDialogOpen(true)}
              className="h-10 px-4 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-bold hover:bg-[#f8fafc] dark:hover:bg-slate-800"
            >
              Extract from Quote
            </button>
            <button onClick={openCreateDialog} className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90">
              Add Contract Item
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {Array.from(groups.entries()).map(([sectionLabel, groupItems]) => (
            <div key={sectionLabel || "_ungrouped"} className="flex flex-col gap-3">
              {sectionLabel && <h3 className="text-sm font-bold uppercase tracking-wide text-[#4c739a] dark:text-slate-400">{sectionLabel}</h3>}
              {groupItems.map((item) => {
                const itemComputed = computedByItemId.get(item.id);
                return (
                  <div key={item.id} className="rounded-xl border border-[#e7edf3] dark:border-slate-700 p-4 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-bold">{item.description}</p>
                      <div className="flex gap-3 shrink-0">
                        <button onClick={() => openEditDialog(item)} className="text-xs font-medium text-primary hover:underline">
                          Edit
                        </button>
                        <button onClick={() => handleDelete(item)} className="text-xs font-medium text-red-600 hover:underline">
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3">
                      {item.components.map((component) => {
                        const componentComputed = itemComputed?.components.find((c) => c.componentId === component.id);
                        return (
                          <div key={component.id} className="rounded-lg bg-[#f8fafc] dark:bg-slate-800/50 p-3 flex flex-col gap-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <span className="font-medium text-sm">{component.label}</span>{" "}
                                <span className="text-xs text-[#4c739a] dark:text-slate-400">
                                  ({component.kind === "weekly_hire" ? "Weekly hire" : "Fixed price"})
                                </span>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-[#4c739a] dark:text-slate-400">
                                  {component.kind === "weekly_hire"
                                    ? `${formatCurrency(Number(component.weeklyRate ?? 0))}/wk`
                                    : formatCurrency(Number(component.amount ?? 0))}
                                </p>
                                <p className="text-sm font-bold">{formatCurrency(componentComputed?.claimedToDate ?? 0)} claimed to date</p>
                              </div>
                            </div>

                            {component.kind === "weekly_hire" ? (
                              <ProgressCheckpointEditor
                                projectId={projectId}
                                componentId={component.id}
                                entries={component.progressEntries}
                                percentLabel="% on hire"
                              />
                            ) : (
                              <div className="flex flex-col gap-2">
                                {component.phases.map((phase) => {
                                  const phasePercent = componentComputed?.phasePercents?.find((p) => p.phaseId === phase.id)?.percent ?? 0;
                                  return (
                                    <div key={phase.id} className="flex flex-col gap-1 border-t border-[#e7edf3] dark:border-slate-700 pt-2">
                                      <div className="flex items-center justify-between text-xs">
                                        <span>
                                          {phase.label} <span className="text-[#4c739a] dark:text-slate-400">({phase.sharePercent}% share)</span>
                                        </span>
                                        <span className="font-bold">{phasePercent}% complete</span>
                                      </div>
                                      <ProgressCheckpointEditor
                                        projectId={projectId}
                                        phaseId={phase.id}
                                        entries={phase.progressEntries}
                                        percentLabel="% complete"
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      <ContractItemFormDialog
        projectId={projectId}
        item={editingItem}
        defaultErectPercent={schedule?.defaultErectPercent ?? null}
        defaultDismantlePercent={schedule?.defaultDismantlePercent ?? null}
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
      />
      <ExtractQuoteDialog projectId={projectId} open={isExtractDialogOpen} onClose={() => setIsExtractDialogOpen(false)} />
    </div>
  );
}
