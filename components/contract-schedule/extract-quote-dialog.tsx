"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ExtractedContractSchedule, ExtractedScheduleItem } from "@/lib/grok";
import type { ComponentState } from "@/components/contract-schedule/types";
import { componentStateToPayload } from "@/components/contract-schedule/types";
import { ComponentEditor } from "@/components/contract-schedule/component-editor";

type DraftItem = {
  included: boolean;
  sectionLabel: string;
  description: string;
  components: ComponentState[];
  confidence: number;
  notes: string | null;
};

function extractedItemToDraft(item: ExtractedScheduleItem): DraftItem {
  return {
    included: true,
    sectionLabel: item.sectionLabel ?? "",
    description: item.description,
    confidence: item.confidence,
    notes: item.notes ?? null,
    components: item.components.map((component) => ({
      kind: component.kind,
      label: component.label,
      amount: component.amount != null ? String(component.amount) : "",
      weeklyRate: component.weeklyRate != null ? String(component.weeklyRate) : "",
      quotedDurationWeeks: component.quotedDurationWeeks != null ? String(component.quotedDurationWeeks) : "",
      // A fixed component with no stated split gets one implicit 100%
      // phase here (matching how the manual add-item form always starts
      // a new fixed component) — the extraction prompt is explicitly told
      // NOT to invent this itself, so it's applied once, client-side,
      // consistently for every such component.
      phases:
        component.kind === "fixed"
          ? component.phases && component.phases.length > 0
            ? component.phases.map((phase) => ({ label: phase.label, sharePercent: String(phase.sharePercent) }))
            : [{ label: component.label, sharePercent: "100" }]
          : []
    }))
  };
}

function formatCurrency(amount: number) {
  return amount.toLocaleString("en-NZ", { style: "currency", currency: "NZD" });
}

export function ExtractQuoteDialog({ projectId, open, onClose }: { projectId: string; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [stage, setStage] = useState<"pick" | "extracting" | "review">("pick");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [sourceFileName, setSourceFileName] = useState<string | undefined>();
  const [sourceStorageKey, setSourceStorageKey] = useState<string | undefined>();
  const [sourceContentType, setSourceContentType] = useState<string | undefined>();
  const [extraction, setExtraction] = useState<ExtractedContractSchedule | null>(null);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [defaultErect, setDefaultErect] = useState("70");
  const [defaultDismantle, setDefaultDismantle] = useState("30");

  function reset() {
    setStage("pick");
    setError(null);
    setExtraction(null);
    setItems([]);
  }

  if (!open) return null;

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setStage("extracting");
    setError(null);

    const formData = new FormData();
    formData.set("file", file);
    const response = await fetch(`/api/projects/${projectId}/contract-schedule/extract`, { method: "POST", body: formData });
    const body = await response.json().catch(() => null);

    setSourceFileName(body?.sourceFileName);
    setSourceStorageKey(body?.sourceStorageKey);
    setSourceContentType(body?.sourceContentType);

    if (!response.ok) {
      setError(typeof body?.error === "string" ? body.error : "Could not read this quote.");
      setStage("pick");
      return;
    }

    const result: ExtractedContractSchedule = body.extraction;
    setExtraction(result);
    setItems(result.items.map(extractedItemToDraft));
    if (result.defaultErectPercent != null) setDefaultErect(String(result.defaultErectPercent));
    if (result.defaultDismantlePercent != null) setDefaultDismantle(String(result.defaultDismantlePercent));
    setStage("review");
  }

  function updateItem(index: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }
  function updateComponent(itemIndex: number, componentIndex: number, patch: Partial<ComponentState>) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === itemIndex
          ? { ...item, components: item.components.map((component, j) => (j === componentIndex ? { ...component, ...patch } : component)) }
          : item
      )
    );
  }
  function removeComponent(itemIndex: number, componentIndex: number) {
    setItems((prev) =>
      prev.map((item, i) => (i === itemIndex ? { ...item, components: item.components.filter((_, j) => j !== componentIndex) } : item))
    );
  }

  async function handleConfirm() {
    setError(null);
    const includedItems = items.filter((item) => item.included);
    if (includedItems.length === 0) {
      setError("Select at least one item to add.");
      return;
    }
    for (const item of includedItems) {
      if (item.components.length === 0) {
        setError(`"${item.description}" needs at least one component.`);
        return;
      }
    }

    setIsSubmitting(true);
    const response = await fetch(`/api/projects/${projectId}/contract-schedule/confirm-extraction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceFileName,
        sourceStorageKey,
        sourceContentType,
        defaultErectPercent: Number(defaultErect) || 0,
        defaultDismantlePercent: Number(defaultDismantle) || 0,
        items: includedItems.map((item) => ({
          description: item.description,
          sectionLabel: item.sectionLabel || null,
          components: item.components.map(componentStateToPayload)
        }))
      })
    });
    setIsSubmitting(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(typeof body?.error === "string" ? body.error : "Could not save these items.");
      return;
    }

    reset();
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="relative w-full max-w-3xl rounded-xl bg-white dark:bg-slate-900 p-6 shadow-lg max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={() => {
            reset();
            onClose();
          }}
          aria-label="Close"
          className="absolute top-3 right-3 rounded-lg p-1 text-[#4c739a] hover:bg-[#e7edf3] dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>

        {stage === "pick" && (
          <>
            <h2 className="text-lg font-bold mb-1">Extract from a quote</h2>
            <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-5">
              Upload the subbie's priced quote (PDF or photo). Every line is read directly off the page — nothing is saved until you
              review and confirm it below.
            </p>
            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
            <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#cfdbe7] dark:border-slate-700 py-10 cursor-pointer hover:border-primary/40">
              <span className="material-symbols-outlined text-3xl text-[#4c739a] dark:text-slate-400 mb-2">upload_file</span>
              <span className="text-sm font-medium">Choose a file</span>
              <input type="file" accept=".pdf,image/*" className="hidden" onChange={handleFileSelected} />
            </label>
          </>
        )}

        {stage === "extracting" && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <span className="material-symbols-outlined text-3xl animate-spin text-primary">progress_activity</span>
            <p className="text-sm text-[#4c739a] dark:text-slate-400">Reading the quote — this can take a minute for a long document.</p>
          </div>
        )}

        {stage === "review" && extraction && (
          <>
            <h2 className="text-lg font-bold mb-1">Review extracted items</h2>
            <p className="text-sm text-[#4c739a] dark:text-slate-400 mb-3">
              Nothing is saved yet — check every line against the original quote, edit anything that's wrong, then confirm.
            </p>

            {extraction.totalMismatchWarning && (
              <p className="text-sm rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 p-3 mb-3">
                {extraction.totalMismatchWarning}
              </p>
            )}
            <p className="text-xs text-[#4c739a] dark:text-slate-400 mb-4">
              Extracted total: {formatCurrency(extraction.computedTotal)}
              {extraction.printedGrandTotal != null && ` · Quote's own printed total: ${formatCurrency(extraction.printedGrandTotal)}`}
            </p>

            <div className="flex gap-3 mb-4">
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
            </div>

            <div className="flex flex-col gap-3">
              {items.map((item, itemIndex) => (
                <div key={itemIndex} className="rounded-lg border border-[#e7edf3] dark:border-slate-700 p-3 flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={item.included}
                      onChange={(event) => updateItem(itemIndex, { included: event.target.checked })}
                      className="mt-2 size-4 shrink-0"
                    />
                    <div className="flex gap-3 flex-1">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(event) => updateItem(itemIndex, { description: event.target.value })}
                        className="h-9 flex-1 rounded-md border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm font-medium"
                      />
                      <input
                        type="text"
                        value={item.sectionLabel}
                        onChange={(event) => updateItem(itemIndex, { sectionLabel: event.target.value })}
                        placeholder="Section (optional)"
                        className="h-9 w-48 rounded-md border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm"
                      />
                    </div>
                    {item.confidence < 0.7 && (
                      <span className="text-xs font-medium text-amber-600 shrink-0 mt-2">Low confidence</span>
                    )}
                  </div>
                  {item.notes && <p className="text-xs text-amber-700 dark:text-amber-400 pl-7">{item.notes}</p>}

                  {item.included && (
                    <div className="pl-7 flex flex-col gap-2">
                      {item.components.map((component, componentIndex) => (
                        <ComponentEditor
                          key={componentIndex}
                          component={component}
                          onChange={(patch) => updateComponent(itemIndex, componentIndex, patch)}
                          onRemove={() => removeComponent(itemIndex, componentIndex)}
                          canRemove={item.components.length > 1}
                          defaultErectPercent={Number(defaultErect) || null}
                          defaultDismantlePercent={Number(defaultDismantle) || null}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {error && <p className="text-sm text-red-600 mt-4">{error}</p>}

            <div className="flex gap-3 justify-end mt-5">
              <button
                type="button"
                onClick={() => {
                  reset();
                  onClose();
                }}
                className="h-10 px-4 rounded-lg border border-[#e7edf3] dark:border-slate-700 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isSubmitting}
                className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60"
              >
                {isSubmitting ? "Saving..." : `Confirm & Add ${items.filter((i) => i.included).length} Item(s)`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
