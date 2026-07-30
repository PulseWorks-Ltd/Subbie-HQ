// Starting preset list for Organisation.trade — deliberately plain strings,
// not a DB enum, so adding a trade later doesn't need a migration. "Other"
// isn't listed here — it's a UI-only option that reveals a free-text input
// instead of one of these values.
export const TRADE_PRESETS = [
  "Scaffolding",
  "Plumbing",
  "Electrician",
  "Painter",
  "Plasterer",
  "General Builder",
  "Roofing",
  "Concrete",
  "Carpentry",
  "Glazing",
  "Landscaping",
  "HVAC",
  "Tiling",
  "Flooring",
  "Bricklaying / Masonry",
  "Fencing"
] as const;
