import type { UpdateCategory } from "@prisma/client";

// Generic category labels offered in the SAME tag <select> as real object
// tags (SI/Variation items, QA records) — see Update.category's schema
// comment. Order here is the display order in every dropdown.
export const UPDATE_CATEGORIES: UpdateCategory[] = [
  "general",
  "progress",
  "health_safety",
  "delay",
  "site_instruction",
  "variation",
  "day_works",
  "delivery",
  "defect",
  "other"
];

export const UPDATE_CATEGORY_LABELS: Record<UpdateCategory, string> = {
  general: "General",
  progress: "Progress",
  health_safety: "H&S",
  delay: "Delay",
  site_instruction: "Site Instruction",
  variation: "Variation",
  day_works: "Day Works",
  delivery: "Delivery",
  defect: "Defect",
  other: "Other"
};

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
  return (UPDATE_CATEGORIES as string[]).includes(category) ? category : null;
}
