"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TaggableContractItem } from "@/lib/contract-schedule";

// One flat "which component/phase" target list per contract item — a
// weekly_hire component is itself the target (no phase concept, see
// lib/contract-schedule.ts), a fixed component's target is one of its
// phases (Erect, Dismantle, Supply, etc., however many it has).
type Target = { key: string; label: string; phaseId?: string; componentId?: string };

function targetsForItem(item: TaggableContractItem): Target[] {
  const targets: Target[] = [];
  for (const component of item.components) {
    if (component.kind === "weekly_hire") {
      targets.push({ key: `component:${component.id}`, label: `${component.label} (% on hire)`, componentId: component.id });
    } else {
      for (const phase of component.phases) {
        targets.push({ key: `phase:${phase.id}`, label: `${component.label} — ${phase.label}`, phaseId: phase.id });
      }
    }
  }
  return targets;
}

// Triggered from the Project Diary entry's own action row (compose-time,
// since the just-posted entry appears in the same thread list right
// after, and after-the-fact on any past entry) — records a dated %-
// complete checkpoint (Phase 3 of the Contract Schedule feature) against
// whichever contract item component/phase the diary entry actually
// reports progress on. Deliberately NOT part of the existing SI/Variation/
// QA tag <select> (components/updates/update-thread.tsx): those three are
// mutually exclusive facets of "what this whole update is about," while a
// diary entry can report contract item progress independently of (or
// alongside) whatever else it's tagged with — e.g. "facade 2 handed over
// today" has nothing to do with which Variation the same entry might also
// be tagged to.
export function AssignUpdateAsContractProgressDialog({
  projectId,
  updateId,
  updateDate,
  contractItems,
  onClose,
  onAssigned
}: {
  projectId: string;
  updateId: string;
  updateDate: string; // ISO date, defaults the checkpoint's effective date
  contractItems: TaggableContractItem[];
  onClose: () => void;
  onAssigned: () => void;
}) {
  const router = useRouter();
  const [itemId, setItemId] = useState(contractItems[0]?.id ?? "");
  const selectedItem = contractItems.find((item) => item.id === itemId);
  const targets = selectedItem ? targetsForItem(selectedItem) : [];
  const [targetKey, setTargetKey] = useState(targets[0]?.key ?? "");
  const [percent, setPercent] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(updateDate.slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleItemChange(newItemId: string) {
    setItemId(newItemId);
    const item = contractItems.find((i) => i.id === newItemId);
    setTargetKey(item ? targetsForItem(item)[0]?.key ?? "" : "");
  }

  async function handleConfirm() {
    setError(null);
    if (percent === "" || Number(percent) < 0 || Number(percent) > 100) {
      setError("Enter a percentage between 0 and 100.");
      return;
    }
    const target = targets.find((t) => t.key === targetKey);
    if (!target) {
      setError("Choose which part of the item this progress applies to.");
      return;
    }

    setIsSubmitting(true);
    const response = await fetch(`/api/projects/${projectId}/contract-schedule/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phaseId: target.phaseId,
        componentId: target.componentId,
        effectiveDate,
        percent: Number(percent),
        projectDiaryUpdateId: updateId
      })
    });
    setIsSubmitting(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(typeof body?.error === "string" ? body.error : "Could not record this progress.");
      return;
    }

    router.refresh();
    onAssigned();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="relative w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 p-5 shadow-lg">
        <h3 className="text-sm font-bold mb-1">Record contract item progress</h3>
        <p className="text-xs text-[#4c739a] dark:text-slate-400 mb-3">
          Adds a dated checkpoint to the Contract Schedule — this diary entry stays exactly as posted.
        </p>

        <label className="flex flex-col gap-1 text-xs font-medium mb-3">
          Contract item
          <select
            value={itemId}
            onChange={(event) => handleItemChange(event.target.value)}
            disabled={isSubmitting}
            className="h-9 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {contractItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.description}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium mb-3">
          Component / phase
          <select
            value={targetKey}
            onChange={(event) => setTargetKey(event.target.value)}
            disabled={isSubmitting}
            className="h-9 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {targets.map((target) => (
              <option key={target.key} value={target.key}>
                {target.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex gap-3 mb-3">
          <label className="flex flex-col gap-1 text-xs font-medium flex-1">
            % complete
            <input
              type="number"
              min={0}
              max={100}
              autoFocus
              value={percent}
              onChange={(event) => setPercent(event.target.value)}
              disabled={isSubmitting}
              className="h-9 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium flex-1">
            As of
            <input
              type="date"
              value={effectiveDate}
              onChange={(event) => setEffectiveDate(event.target.value)}
              disabled={isSubmitting}
              className="h-9 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
        </div>

        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-9 px-3 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-medium disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting || targets.length === 0}
            className="h-9 px-3 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
          >
            {isSubmitting ? "Saving..." : "Record progress"}
          </button>
        </div>
      </div>
    </div>
  );
}
