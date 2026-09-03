"use client";

import type { ComponentState, ComponentKind, PhaseState } from "@/components/contract-schedule/types";
import { phaseShareTotal } from "@/components/contract-schedule/types";

// One component's fields (kind/label/amount-or-rate/phases) — shared by the
// manual add/edit item dialog and the quote-extraction review screen, so
// the two don't drift into subtly different editing behaviour for what is
// ultimately the exact same nested payload shape.
export function ComponentEditor({
  component,
  onChange,
  onRemove,
  canRemove,
  defaultErectPercent,
  defaultDismantlePercent
}: {
  component: ComponentState;
  onChange: (patch: Partial<ComponentState>) => void;
  onRemove: () => void;
  canRemove: boolean;
  defaultErectPercent: number | null;
  defaultDismantlePercent: number | null;
}) {
  function updatePhase(phaseIndex: number, patch: Partial<PhaseState>) {
    onChange({ phases: component.phases.map((phase, j) => (j === phaseIndex ? { ...phase, ...patch } : phase)) });
  }
  function addPhase() {
    onChange({ phases: [...component.phases, { label: "", sharePercent: "0" }] });
  }
  function removePhase(phaseIndex: number) {
    onChange({ phases: component.phases.filter((_, j) => j !== phaseIndex) });
  }
  function applyErectDismantleDefault() {
    const erect = defaultErectPercent ?? 70;
    const dismantle = defaultDismantlePercent ?? 100 - erect;
    onChange({ phases: [{ label: "Erect", sharePercent: String(erect) }, { label: "Dismantle", sharePercent: String(dismantle) }] });
  }

  const shareTotal = phaseShareTotal(component);

  return (
    <div className="rounded-lg border border-[#e7edf3] dark:border-slate-700 p-3 flex flex-col gap-3">
      <div className="flex gap-3 items-end">
        <label className="flex flex-col gap-1 text-xs font-medium w-36">
          Kind
          <select
            value={component.kind}
            onChange={(event) => onChange({ kind: event.target.value as ComponentKind })}
            className="h-9 rounded-md border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm"
          >
            <option value="fixed">Fixed price</option>
            <option value="weekly_hire">Weekly hire</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium flex-1">
          Label
          <input
            type="text"
            required
            value={component.label}
            onChange={(event) => onChange({ label: event.target.value })}
            placeholder={component.kind === "fixed" ? "e.g. Erect & Dismantle" : "e.g. Weekly Hire"}
            className="h-9 rounded-md border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm"
          />
        </label>
        {canRemove && (
          <button type="button" onClick={onRemove} className="h-9 px-2 text-xs font-medium text-red-600">
            Remove
          </button>
        )}
      </div>

      {component.kind === "fixed" ? (
        <>
          <label className="flex flex-col gap-1 text-xs font-medium w-40">
            Amount ($, excl. GST)
            <input
              type="number"
              min={0}
              step="0.01"
              value={component.amount}
              onChange={(event) => onChange({ amount: event.target.value })}
              className="h-9 rounded-md border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm"
            />
          </label>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">
                Phases <span className="text-[#4c739a] dark:text-slate-400">(shares must total 100%)</span>
              </span>
              <button type="button" onClick={applyErectDismantleDefault} className="text-xs font-medium text-primary hover:underline">
                Use Erect/Dismantle default
              </button>
            </div>
            {component.phases.map((phase, phaseIndex) => (
              <div key={phaseIndex} className="flex gap-2 items-center">
                <input
                  type="text"
                  required
                  value={phase.label}
                  onChange={(event) => updatePhase(phaseIndex, { label: event.target.value })}
                  placeholder="e.g. Erect"
                  className="h-8 flex-1 rounded-md border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs"
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={phase.sharePercent}
                  onChange={(event) => updatePhase(phaseIndex, { sharePercent: event.target.value })}
                  className="h-8 w-20 rounded-md border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs"
                />
                <span className="text-xs text-[#4c739a] dark:text-slate-400">%</span>
                {component.phases.length > 1 && (
                  <button type="button" onClick={() => removePhase(phaseIndex)} className="text-[#4c739a] hover:text-red-600">
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                )}
              </div>
            ))}
            <div className="flex items-center justify-between">
              <button type="button" onClick={addPhase} className="text-xs font-medium text-primary hover:underline self-start">
                + Add phase
              </button>
              <span className={`text-xs font-medium ${Math.abs(shareTotal - 100) > 0.01 ? "text-red-600" : "text-[#4c739a] dark:text-slate-400"}`}>
                Total: {shareTotal}%
              </span>
            </div>
          </div>
        </>
      ) : (
        <div className="flex gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium w-40">
            Weekly rate ($)
            <input
              type="number"
              min={0}
              step="0.01"
              value={component.weeklyRate}
              onChange={(event) => onChange({ weeklyRate: event.target.value })}
              className="h-9 rounded-md border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium w-48">
            Quoted duration (weeks) <span className="text-[#4c739a] dark:text-slate-400">(optional)</span>
            <input
              type="number"
              min={0}
              step="0.5"
              value={component.quotedDurationWeeks}
              onChange={(event) => onChange({ quotedDurationWeeks: event.target.value })}
              className="h-9 rounded-md border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm"
            />
          </label>
        </div>
      )}
    </div>
  );
}
