"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ItemWithComponents, ScheduleWithItems, LinkedDiaryEntry } from "@/lib/contract-schedule";
import { ContractItemFormDialog } from "@/components/contract-schedule/contract-item-form-dialog";
import { ExtractQuoteDialog } from "@/components/contract-schedule/extract-quote-dialog";
import { QuickPercentEntry, ProgressHistory } from "@/components/contract-schedule/progress-checkpoint-editor";

function formatEntryDate(date: Date) {
  return new Date(date).toLocaleDateString("en-NZ", { day: "2-digit", month: "short" });
}

function formatCurrency(amount: number) {
  return amount.toLocaleString("en-NZ", { style: "currency", currency: "NZD" });
}

// Pre-Launch Feature 1's "discoverable from the Contract Works item" side —
// a count that expands to the real linked Project Diary entries, each
// linking back to Project Diary (there's no single-entry detail route, so
// this links to the diary list itself, which highlights/scrolls to nothing
// specific but is the closest existing destination).
function LinkedDiaryEntries({ projectId, entries }: { projectId: string; entries: LinkedDiaryEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  if (entries.length === 0) return null;
  return (
    <div className="text-xs">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="font-medium text-[#4c739a] dark:text-slate-400 hover:text-primary hover:underline"
      >
        {expanded ? "Hide" : "Show"} linked diary {entries.length === 1 ? "entry" : "entries"} ({entries.length})
      </button>
      {expanded && (
        <ul className="mt-1 flex flex-col gap-1 pl-3 border-l-2 border-[#e7edf3] dark:border-slate-700">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Link href={`/projects/${projectId}/updates`} className="hover:underline">
                <span className="text-[#4c739a] dark:text-slate-400">{formatEntryDate(entry.createdAt)} · {entry.authorName}:</span>{" "}
                {entry.body.length > 80 ? `${entry.body.slice(0, 80)}…` : entry.body}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type ComputedComponent = {
  componentId: string;
  currentPercent: number | null;
  claimedToDate: number;
  phasePercents?: { phaseId: string; percent: number }[];
};
type ComputedItem = { itemId: string; components: ComputedComponent[] };

// The condensed row's one aggregate % — a weighted-by-value rollup across
// every FIXED component on the item (weekly_hire is excluded from "Total
// value" since it's an ongoing rate, not a fixed sum, so folding its
// claimed-to-date into the same percentage would be misleading rather
// than helpful). An item that's only ever weekly hire has no fixed total
// to claim a % of — shown as "—", not a divide-by-zero 0%/100%.
function computeItemSummary(item: ItemWithComponents, itemComputed: ComputedItem | undefined) {
  let totalValue = 0;
  let claimedToDate = 0;
  for (const component of item.components) {
    const componentComputed = itemComputed?.components.find((c) => c.componentId === component.id);
    claimedToDate += componentComputed?.claimedToDate ?? 0;
    if (component.kind === "fixed") totalValue += Number(component.amount ?? 0);
  }
  return { totalValue, claimedToDate, percent: totalValue > 0 ? Math.round((claimedToDate / totalValue) * 100) : null };
}

// Pre-Launch Feature 6 — condensed by default (Total value / % claimed
// only), full component/phase breakdown + quick entry + history revealed
// only on click. Each item manages its own expand state independently, so
// opening one doesn't affect its siblings.
function ContractItemRow({
  projectId,
  item,
  itemComputed,
  linkedDiaryEntries,
  onEdit,
  onDelete
}: {
  projectId: string;
  item: ItemWithComponents;
  itemComputed: ComputedItem | undefined;
  linkedDiaryEntries: LinkedDiaryEntry[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const summary = computeItemSummary(item, itemComputed);

  return (
    <div id={`contract-item-${item.id}`} className="rounded-xl border border-[#e7edf3] dark:border-slate-700 scroll-mt-20">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="w-full flex items-center justify-between gap-3 p-4 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-lg text-[#4c739a] dark:text-slate-400 shrink-0">
            {expanded ? "expand_less" : "expand_more"}
          </span>
          <p className="font-bold truncate">{item.description}</p>
        </div>
        <div className="flex items-center gap-4 shrink-0 text-sm">
          <span className="text-[#4c739a] dark:text-slate-400">{formatCurrency(summary.totalValue)}</span>
          <span className="font-bold w-14 text-right">{summary.percent != null ? `${summary.percent}%` : "—"}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-3 border-t border-[#e7edf3] dark:border-slate-700 pt-3">
          <div className="flex items-start justify-between gap-3">
            <LinkedDiaryEntries projectId={projectId} entries={linkedDiaryEntries} />
            <div className="flex gap-3 shrink-0">
              <button type="button" onClick={onEdit} className="text-xs font-medium text-primary hover:underline">
                Edit
              </button>
              <button type="button" onClick={onDelete} className="text-xs font-medium text-red-600 hover:underline">
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
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <QuickPercentEntry
                        projectId={projectId}
                        componentId={component.id}
                        currentPercent={componentComputed?.currentPercent ?? 0}
                        percentLabel="% on hire"
                      />
                      <ProgressHistory projectId={projectId} entries={component.progressEntries} percentLabel="% on hire" />
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {component.phases.map((phase) => {
                        const phasePercent = componentComputed?.phasePercents?.find((p) => p.phaseId === phase.id)?.percent ?? 0;
                        return (
                          <div key={phase.id} className="flex flex-col gap-1.5 border-t border-[#e7edf3] dark:border-slate-700 pt-2">
                            <div className="flex items-center justify-between text-xs">
                              <span>
                                {phase.label} <span className="text-[#4c739a] dark:text-slate-400">({phase.sharePercent}% share)</span>
                              </span>
                              <span className="font-bold">{phasePercent}% complete</span>
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <QuickPercentEntry
                                projectId={projectId}
                                phaseId={phase.id}
                                currentPercent={phasePercent}
                                percentLabel="% complete"
                              />
                              <ProgressHistory projectId={projectId} entries={phase.progressEntries} percentLabel="% complete" />
                            </div>
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
      )}
    </div>
  );
}

// Sections default open (so the schedule isn't a wall of blank headings on
// first load) — each still independently collapsible, which is what
// actually matters for "faster interaction" on a long multi-section
// schedule (collapse the sections you're not touching right now).
function SectionGroup({
  sectionLabel,
  children
}: {
  sectionLabel: string;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setCollapsed((current) => !current)}
        className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-[#4c739a] dark:text-slate-400 hover:text-primary self-start"
      >
        <span className="material-symbols-outlined text-base">{collapsed ? "chevron_right" : "expand_more"}</span>
        {sectionLabel}
      </button>
      {!collapsed && <div className="flex flex-col gap-3">{children}</div>}
    </div>
  );
}

export function ContractScheduleView({
  projectId,
  projectName,
  schedule,
  totalValue,
  computed,
  linkedDiaryEntriesByItemId
}: {
  projectId: string;
  projectName: string;
  schedule: ScheduleWithItems | null;
  totalValue: number;
  computed: ComputedItem[];
  linkedDiaryEntriesByItemId: Record<string, LinkedDiaryEntry[]>;
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
        // Pre-Launch Feature 6 — a sticky left panel (total + defaults +
        // the two schedule-level actions) that stays in view while the
        // (now collapsible, condensed) item list on the right scrolls past
        // it. Single column on mobile/tablet (nothing to keep pinned
        // beside on a narrow screen); two columns from `lg` up.
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
          <div className="lg:sticky lg:top-4 flex flex-col gap-4 rounded-xl border border-[#e7edf3] dark:border-slate-700 p-4">
            <div>
              <p className="text-xs text-[#4c739a] dark:text-slate-400">Original Subcontract Sum</p>
              <p className="text-xl font-bold">{formatCurrency(totalValue)}</p>
            </div>
            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-1 text-xs font-medium">
                Default Erect %
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={defaultErect}
                  onChange={(event) => setDefaultErect(event.target.value)}
                  className="h-8 rounded-md border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs"
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
                  className="h-8 rounded-md border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs"
                />
              </label>
              <button
                onClick={saveDefaults}
                disabled={isSavingDefaults}
                className="h-8 px-3 rounded-md border border-[#e7edf3] dark:border-slate-700 text-xs font-medium disabled:opacity-60 self-start"
              >
                {isSavingDefaults ? "Saving..." : "Save defaults"}
              </button>
            </div>
            <div className="flex flex-col gap-2 pt-2 border-t border-[#e7edf3] dark:border-slate-700">
              <button
                onClick={() => setIsExtractDialogOpen(true)}
                className="h-9 px-3 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-xs font-bold hover:bg-[#f8fafc] dark:hover:bg-slate-800"
              >
                Extract from Quote
              </button>
              <button onClick={openCreateDialog} className="h-9 px-3 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90">
                Add Contract Item
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-6 min-w-0">
            {Array.from(groups.entries()).map(([sectionLabel, groupItems]) => {
              const rows = groupItems.map((item) => (
                <ContractItemRow
                  key={item.id}
                  projectId={projectId}
                  item={item}
                  itemComputed={computedByItemId.get(item.id)}
                  linkedDiaryEntries={linkedDiaryEntriesByItemId[item.id] ?? []}
                  onEdit={() => openEditDialog(item)}
                  onDelete={() => handleDelete(item)}
                />
              ));
              // Unlabelled items (no sectionLabel) render as a plain list —
              // a collapsible header naming nothing would be confusing.
              return sectionLabel ? (
                <SectionGroup key={sectionLabel} sectionLabel={sectionLabel}>
                  {rows}
                </SectionGroup>
              ) : (
                <div key="_ungrouped" className="flex flex-col gap-3">
                  {rows}
                </div>
              );
            })}
          </div>
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
