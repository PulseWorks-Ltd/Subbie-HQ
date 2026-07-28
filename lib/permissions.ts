export const MODULES = [
  "contract",
  "scope",
  "programme",
  "updates",
  "site_instructions",
  "variations",
  "pictures",
  "correspondence",
  "health_safety",
  "payment_claims",
  "evidence",
  "insurance",
  "quoting"
] as const;

export type ModuleKey = (typeof MODULES)[number];

export type ModulePermissions = Partial<Record<ModuleKey, boolean>>;

export const MODULE_LABELS: Record<ModuleKey, string> = {
  contract: "Contract",
  scope: "Scope",
  programme: "Programme",
  updates: "Updates",
  site_instructions: "Site Instructions",
  variations: "Variations",
  pictures: "Pictures",
  correspondence: "Correspondence",
  health_safety: "Health & Safety",
  payment_claims: "Payment Claims",
  // Retained for the future Payment Claims evidence-bundle feature (see TODOs in
  // lib/dashboard.ts / variation-items routes) — no nav item uses this module today,
  // since Pictures + Correspondence replaced the old Evidence placeholder page.
  evidence: "Evidence",
  // Gates the global, organisation-level Insurance page (app/(app)/insurance)
  // — not any project route. Company insurance certificates apply across
  // every project, so this module isn't checked via requireModuleAccess
  // (which is project-scoped); it's checked directly against the
  // OrganisationMember row via hasModuleAccess.
  insurance: "Insurance",
  quoting: "Quoting"
};

export type PresetKey = "admin" | "operations" | "supervisor" | "health_safety_only";

export const PRESETS: Record<PresetKey, { label: string; isAdmin: boolean; modules: ModulePermissions }> = {
  admin: {
    label: "Admin",
    isAdmin: true,
    modules: Object.fromEntries(MODULES.map((module) => [module, true])) as ModulePermissions
  },
  operations: {
    label: "Operations / Project Manager",
    isAdmin: false,
    modules: {
      contract: true,
      scope: true,
      programme: true,
      updates: true,
      site_instructions: true,
      variations: true,
      pictures: true,
      correspondence: true,
      health_safety: true,
      payment_claims: true,
      evidence: true,
      insurance: true,
      quoting: true
    }
  },
  supervisor: {
    label: "Supervisor",
    isAdmin: false,
    modules: {
      updates: true,
      site_instructions: true,
      pictures: true,
      health_safety: true,
      programme: true
    }
  },
  health_safety_only: {
    label: "Health & Safety Only",
    isAdmin: false,
    modules: {
      health_safety: true
    }
  }
};

export function hasModuleAccess(
  member: { isAdmin: boolean; modules: unknown } | null | undefined,
  module: ModuleKey
): boolean {
  if (!member) return false;
  if (member.isAdmin) return true;
  const modules = member.modules as ModulePermissions | null;
  return Boolean(modules?.[module]);
}
