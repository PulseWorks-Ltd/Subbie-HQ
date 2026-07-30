// Single source of truth for turning a User's firstName/lastName into a
// display string — used everywhere a person's name is shown (Updates,
// Correspondence, Team page, notifications, session display) so the
// "what if one/both are missing" fallback logic lives in exactly one place.
export function formatUserName(user: { firstName: string | null; lastName: string | null }): string | null {
  const parts = [user.firstName, user.lastName].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" ") : null;
}

// Best-effort split of a single free-text name into firstName/lastName —
// "first word vs. remainder", same rule used to backfill existing User rows
// in the split_user_name migration. Used by the invite-accept flow, which
// still collects a single "Your name" field (see Task 1.3 — that flow is
// deliberately unchanged here, this just adapts its write to the new
// firstName/lastName columns).
export function splitFullName(fullName: string): { firstName: string; lastName: string | null } {
  const trimmed = fullName.trim();
  const spaceIndex = trimmed.indexOf(" ");
  if (spaceIndex === -1) return { firstName: trimmed, lastName: null };
  return { firstName: trimmed.slice(0, spaceIndex), lastName: trimmed.slice(spaceIndex + 1).trim() || null };
}
