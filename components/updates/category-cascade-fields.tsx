"use client";

import { UPDATE_CATEGORIES, UPDATE_CATEGORY_LABELS, categoryOptionValue, parseCategoryOptionValue, legacyCategoryOptionIfCurrent } from "@/lib/update-category";
import { ASSIGN_QA_SENTINEL } from "@/lib/qa-tag";
import type { UpdateCategory } from "@prisma/client";

type TaggableItem = { id: string; reference: string; title: string };

const SI_FREE_TEXT_SENTINEL = "__free_text_si__";
const SI_NONE_SENTINEL = "";

// Pre-Launch category restructure — the ONE place this cascading logic
// lives, shared by the compose form (update-composer.tsx) and both post-
// hoc edit views (update-thread.tsx, mobile-thread.tsx) rather than
// tripling it. "Site Instruction" is no longer its own primary category
// (redundant with tagging the real SI directly), and the old flat
// "Site Instructions / Variations" optgroup of real items is gone from
// the primary dropdown entirely — picking a specific real SI/Variation
// now only happens through this secondary control, reached via primary =
// "Variation". "Contract" replaces "Progress" as a primary category and,
// per this pass's own scoping, points at the separate "Assign to Contract
// Works" field already on the same form (see ContractItemMultiSelect)
// rather than duplicating a second picker for the identical underlying
// link.
export function CategoryCascadeFields({
  primary,
  onPrimaryChange,
  currentCategory,
  taggableItems,
  variationSecondary,
  onVariationSecondaryChange,
  freeText,
  onFreeTextChange,
  disabled
}: {
  primary: string;
  onPrimaryChange: (value: string) => void;
  // The update's OWN current category (or null) — needed only to decide
  // whether a legacy-only option (progress/site_instruction) must still
  // render so an old update doesn't silently lose its visible tag.
  currentCategory: UpdateCategory | null | undefined;
  taggableItems: TaggableItem[];
  variationSecondary: string; // "" | SI_FREE_TEXT_SENTINEL | a real VariationItem id
  onVariationSecondaryChange: (value: string) => void;
  freeText: string;
  onFreeTextChange: (value: string) => void;
  disabled?: boolean;
}) {
  const legacyOption = legacyCategoryOptionIfCurrent(currentCategory);
  const isVariation = parseCategoryOptionValue(primary) === "variation";
  const isContract = parseCategoryOptionValue(primary) === "contract";

  return (
    <div className="flex flex-col gap-2">
      <select
        value={primary}
        onChange={(event) => onPrimaryChange(event.target.value)}
        disabled={disabled}
        className="h-9 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
      >
        <option value="">Not Assigned</option>
        <option value={ASSIGN_QA_SENTINEL}>Assign QA</option>
        {UPDATE_CATEGORIES.map((category) => (
          <option key={category} value={categoryOptionValue(category)}>
            {UPDATE_CATEGORY_LABELS[category]}
          </option>
        ))}
        {legacyOption && <option value={categoryOptionValue(legacyOption)}>{UPDATE_CATEGORY_LABELS[legacyOption]}</option>}
      </select>

      {isVariation && (
        <div className="flex flex-col gap-1 pl-3 border-l-2 border-[#e7edf3] dark:border-slate-700">
          <select
            value={variationSecondary}
            onChange={(event) => onVariationSecondaryChange(event.target.value)}
            disabled={disabled}
            className="h-8 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
          >
            <option value={SI_NONE_SENTINEL}>N/A — not tied to a specific Site Instruction</option>
            {taggableItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.reference} — {item.title}
              </option>
            ))}
            <option value={SI_FREE_TEXT_SENTINEL}>Enter own Site Instruction...</option>
          </select>
          {variationSecondary === SI_FREE_TEXT_SENTINEL && (
            <input
              type="text"
              value={freeText}
              onChange={(event) => onFreeTextChange(event.target.value)}
              placeholder="e.g. SI-260 (not yet in Subbie HQ)"
              disabled={disabled}
              className="h-8 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
            />
          )}
        </div>
      )}

      {isContract && (
        <p className="text-xs text-[#4c739a] dark:text-slate-400 pl-3 border-l-2 border-[#e7edf3] dark:border-slate-700">
          Use "Assign to Contract Works" below to link the specific item(s) this relates to.
        </p>
      )}
    </div>
  );
}

export { SI_FREE_TEXT_SENTINEL, SI_NONE_SENTINEL };
