"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ItemWithComponents } from "@/lib/contract-schedule";
import type { ComponentState } from "@/components/contract-schedule/types";
import { blankComponent, phaseShareTotal, componentStateToPayload } from "@/components/contract-schedule/types";
import { ComponentEditor } from "@/components/contract-schedule/component-editor";

function componentToState(component: ItemWithComponents["components"][number]): ComponentState {
  return {
    id: component.id,
    kind: component.kind,
    label: component.label,
    amount: component.amount != null ? String(component.amount) : "",
    weeklyRate: component.weeklyRate != null ? String(component.weeklyRate) : "",
    quotedDurationWeeks: component.quotedDurationWeeks != null ? String(component.quotedDurationWeeks) : "",
    phases: component.phases.map((phase) => ({ id: phase.id, label: phase.label, sharePercent: String(phase.sharePercent) }))
  };
}

export function ContractItemFormDialog({
  projectId,
  item,
  defaultErectPercent,
  defaultDismantlePercent,
  open,
  onClose
}: {
  projectId: string;
  item?: ItemWithComponents | null;
  defaultErectPercent: number | null;
  defaultDismantlePercent: number | null;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const isEditing = Boolean(item);

  const [description, setDescription] = useState(item?.description ?? "");
  const [sectionLabel, setSectionLabel] = useState(item?.sectionLabel ?? "");
  const [components, setComponents] = useState<ComponentState[]>(
    item ? item.components.map(componentToState) : [blankComponent()]
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) return null;

  function updateComponent(index: number, patch: Partial<ComponentState>) {
    setComponents((prev) => prev.map((component, i) => (i === index ? { ...component, ...patch } : component)));
  }
  function addComponent() {
    setComponents((prev) => [...prev, blankComponent()]);
  }
  function removeComponent(index: number) {
    setComponents((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    for (const component of components) {
      if (component.kind === "fixed" && Math.abs(phaseShareTotal(component) - 100) > 0.01) {
        setError(`"${component.label || "A component"}"'s phase shares must add up to 100%.`);
        return;
      }
    }

    setIsSubmitting(true);
    const body = {
      description,
      sectionLabel: sectionLabel || null,
      components: components.map(componentStateToPayload)
    };

    const url = isEditing
      ? `/api/projects/${projectId}/contract-schedule/items/${item!.id}`
      : `/api/projects/${projectId}/contract-schedule/items`;

    const response = await fetch(url, {
      method: isEditing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    setIsSubmitting(false);
    if (!response.ok) {
      const responseBody = await response.json().catch(() => null);
      setError(typeof responseBody?.error === "string" ? responseBody.error : "Could not save the item.");
      return;
    }

    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="relative w-full max-w-2xl rounded-xl bg-white dark:bg-slate-900 p-6 shadow-lg max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 rounded-lg p-1 text-[#4c739a] hover:bg-[#e7edf3] dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>
        <h2 className="text-lg font-bold mb-1">{isEditing ? "Edit contract item" : "Add contract item"}</h2>
        <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-5">
          One line from the subbie's priced quote — split into whichever components it was actually priced with (Supply, Install,
          Erect &amp; Dismantle, Transport, Weekly Hire, etc.).
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium flex-1">
              Description
              <input
                type="text"
                required
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="e.g. Stage A"
                className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium flex-1">
              Section <span className="font-normal text-[#4c739a] dark:text-slate-400">(optional)</span>
              <input
                type="text"
                value={sectionLabel}
                onChange={(event) => setSectionLabel(event.target.value)}
                placeholder="e.g. North Elevation"
                className="h-10 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>
          </div>

          <div className="flex flex-col gap-3">
            {components.map((component, componentIndex) => (
              <ComponentEditor
                key={componentIndex}
                component={component}
                onChange={(patch) => updateComponent(componentIndex, patch)}
                onRemove={() => removeComponent(componentIndex)}
                canRemove={components.length > 1}
                defaultErectPercent={defaultErectPercent}
                defaultDismantlePercent={defaultDismantlePercent}
              />
            ))}

            <button type="button" onClick={addComponent} className="text-sm font-medium text-primary hover:underline self-start">
              + Add another component
            </button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 justify-end mt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
            >
              {isSubmitting ? "Saving..." : isEditing ? "Save changes" : "Add item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
