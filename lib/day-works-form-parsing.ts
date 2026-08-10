// Shared field-normalization helpers for saving reviewed/edited draft rows
// (Day Works Sheet records, Materials, Plant) — used by both the original
// per-sheet sheet-records route and the unified Labour, Plant & Material
// save route, so the same "blank means null, never a rejected save" rules
// apply identically everywhere a reviewed draft gets persisted.

export function toNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function toNullableDate(value: unknown): Date | null {
  const str = toNullableString(value);
  if (!str) return null;
  const date = new Date(str);
  return Number.isNaN(date.getTime()) ? null : date;
}
