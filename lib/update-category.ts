import type { UpdateCategory } from "@prisma/client";

// Generic category labels offered in the SAME tag <select> as real object
// tags (SI/Variation items, QA records) — see Update.category's schema
// comment. Order here is the display order in every dropdown.
//
// Pre-Launch category restructure: `progress` and `site_instruction` are
// deliberately NOT in this list any more — they're still valid enum
// values (kept for existing rows, see UpdateCategory's own schema
// comment), just no longer offered as a NEW choice. `progress` is
// superseded by `contract` (genuinely new behaviour: a cascading Contract
// Item picker, not just a relabel). `site_instruction` was redundant with
// tagging the real SI directly via variationItemId, which already existed.
export const UPDATE_CATEGORIES: UpdateCategory[] = [
  "general",
  "contract",
  "health_safety",
  "delay",
  "variation",
  "day_works",
  "delivery",
  "defect",
  "other"
];

// Every legacy value gets a label too (site_instruction/progress) so an
// EXISTING update tagged with one of them still displays correctly —
// they're just excluded from UPDATE_CATEGORIES above, not from this map.
export const UPDATE_CATEGORY_LABELS: Record<UpdateCategory, string> = {
  general: "General",
  progress: "Progress (legacy)",
  health_safety: "H&S",
  delay: "Delay",
  site_instruction: "Site Instruction (legacy)",
  variation: "Variation",
  day_works: "Day Works",
  delivery: "Delivery",
  defect: "Defect",
  other: "Other",
  contract: "Contract"
};

// A category whose value is one of these two legacy-only categories still
// needs to render AS an option in the <select> when it's the update's
// CURRENT value (so editing an old update doesn't silently blank out its
// existing tag) — but should never be offered as a fresh choice on an
// update that isn't already tagged with it. Callers build their options
// list from UPDATE_CATEGORIES, then conditionally append this one extra
// option only when the current value warrants it.
const LEGACY_ONLY_CATEGORIES: UpdateCategory[] = ["progress", "site_instruction"];
export function legacyCategoryOptionIfCurrent(current: UpdateCategory | null | undefined): UpdateCategory | null {
  return current && LEGACY_ONLY_CATEGORIES.includes(current) ? current : null;
}

// The combined tag <select> has to distinguish three kinds of option value
// in one flat string namespace: "" (Not Assigned), the ASSIGN_QA_SENTINEL
// (see lib/qa-tag.ts), a real VariationItem/QARecord cuid, or one of these
// fixed categories — so category values are prefixed to tell them apart
// from a real id without ever colliding with one.
const CATEGORY_OPTION_PREFIX = "category:";

export function categoryOptionValue(category: UpdateCategory): string {
  return `${CATEGORY_OPTION_PREFIX}${category}`;
}

export function parseCategoryOptionValue(value: string): UpdateCategory | null {
  if (!value.startsWith(CATEGORY_OPTION_PREFIX)) return null;
  const category = value.slice(CATEGORY_OPTION_PREFIX.length) as UpdateCategory;
  return category in UPDATE_CATEGORY_LABELS ? category : null;
}
