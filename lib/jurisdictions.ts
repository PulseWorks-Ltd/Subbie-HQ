// Starting preset list for Organisation.jurisdiction — plain strings, not a
// DB enum, so adding finer granularity later (e.g. per-state Australia)
// doesn't need a migration. Data capture only: see Organisation.jurisdiction
// in prisma/schema.prisma — this is not wired into Contract Review.
export const JURISDICTION_PRESETS = ["New Zealand", "Australia"] as const;
