"use client";

import { useMemo, useState } from "react";
import type { TaggableContractItem } from "@/lib/contract-schedule";

// Pre-Launch Feature 1 — "Assign to Contract Works". A searchable
// multi-select rendered as removable chips, shared by the compose form
// and every post-hoc edit surface (desktop UpdateThread, MobileThread) so
// the picking UX and its underlying id list are defined in exactly one
// place. Deliberately item-level (not component/phase-level, unlike the
// existing "+Progress" assign-as-contract-progress dialog) — this is a
// discoverability link, not a % checkpoint.
export function ContractItemMultiSelect({
  items,
  selectedIds,
  onChange,
  disabled
}: {
  items: TaggableContractItem[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const selected = useMemo(() => items.filter((item) => selectedIds.includes(item.id)), [items, selectedIds]);
  const matches = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    return items
      .filter((item) => !selectedIds.includes(item.id))
      .filter((item) => !trimmed || item.description.toLowerCase().includes(trimmed))
      .slice(0, 8);
  }, [items, selectedIds, query]);

  function add(id: string) {
    onChange([...selectedIds, id]);
    setQuery("");
  }
  function remove(id: string) {
    onChange(selectedIds.filter((existing) => existing !== id));
  }

  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-[#4c739a] dark:text-slate-400">Assign to Contract Works (optional)</p>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((item) => (
            <span
              key={item.id}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-[11px] px-2 py-1"
            >
              {item.description}
              {!disabled && (
                <button type="button" onClick={() => remove(item.id)} className="font-bold" aria-label={`Remove ${item.description}`}>
                  &times;
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {!disabled && (
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search Contract Works items..."
            className="h-8 w-full rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          {query.trim() && matches.length > 0 && (
            <div className="absolute z-10 mt-1 w-full max-h-40 overflow-y-auto rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
              {matches.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => add(item.id)}
                  className="block w-full text-left px-2 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  {item.description}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
