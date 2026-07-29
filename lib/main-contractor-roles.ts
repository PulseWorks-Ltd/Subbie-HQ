// Common contact role presets — offered as quick-select options, but the
// underlying field is plain free text (MainContractorContact.role) so any
// custom role is just as valid. CONTRACTS_MANAGER_ROLE is what the response
// letter drafting flow defaults its "addressed to" contact to, when set.
export const MAIN_CONTRACTOR_ROLE_PRESETS = [
  "Health & Safety Officer",
  "Project Manager",
  "Site Manager",
  "Quantity Surveyor",
  "Contracts Manager"
] as const;

export const CONTRACTS_MANAGER_ROLE = "Contracts Manager";
