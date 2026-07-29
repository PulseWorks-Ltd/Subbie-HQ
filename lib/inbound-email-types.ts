// Common presets shown in the Incoming Emails review UI and given to Grok
// as suggestions — deliberately NOT a database enum. The type on
// InboundEmail/Correspondence is a plain string, so a new category can be
// typed in at any time without a schema migration.
export const INBOUND_EMAIL_TYPE_PRESETS = [
  "Variation",
  "Site Instruction",
  "Programme change",
  "Scope of works addition/change",
  "General reference information",
  "Potential payment claim material",
  "Potential dispute/arbitration material"
] as const;
