// Fixed, closed set — must match prisma/schema.prisma's FindingCategory enum
// and lib/grok.ts's FindingCategorySchema exactly (Contract Review redesign
// Phase 1). Icon names are Material Symbols, matching this app's existing
// icon convention (see DashboardSection, DocumentPanel) rather than emoji.
export const FINDING_CATEGORY_LABELS: Record<string, string> = {
  payment_cash_flow: "Payment & Cash Flow",
  variations: "Variations",
  notices_time_bars: "Notices & Time Bars",
  programme_delay: "Programme & Delay",
  liability_indemnity: "Liability & Indemnity",
  insurance: "Insurance",
  administration_documentation: "Administration & Documentation",
  health_safety: "Health & Safety",
  intellectual_property: "Intellectual Property",
  final_account: "Final Account",
  termination: "Termination",
  site_facilities_operations: "Site Facilities & Operations",
  other: "Other"
};

export const FINDING_CATEGORY_ICONS: Record<string, string> = {
  payment_cash_flow: "payments",
  variations: "edit_note",
  notices_time_bars: "gavel",
  programme_delay: "event_busy",
  liability_indemnity: "balance",
  insurance: "verified_user",
  administration_documentation: "description",
  health_safety: "health_and_safety",
  intellectual_property: "copyright",
  final_account: "receipt_long",
  termination: "cancel",
  site_facilities_operations: "construction",
  other: "category"
};

export function findingCategoryLabel(category: string): string {
  return FINDING_CATEGORY_LABELS[category] ?? category;
}

export function findingCategoryIcon(category: string): string {
  return FINDING_CATEGORY_ICONS[category] ?? "category";
}
