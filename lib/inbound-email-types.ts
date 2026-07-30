// Common presets shown in the Incoming Emails review UI and given to Grok
// as suggestions — deliberately NOT a database enum. The type on
// InboundEmail/Correspondence is a plain string, so a new category can be
// typed in at any time without a schema migration.
//
// TODO (deferred, needs its own design pass): Variation/Site Instruction is
// the only type today with a real "extract structured details + create it"
// destination (see fileInboundEmail's createVariationItem). Other presets
// here — Programme change, Potential payment claim material — could
// eventually get the same treatment into their own modules (e.g. Programme,
// Payment Claims once that feature is built out), and categories not listed
// here at all (H&S, Contract, Evidence) would need a similar per-destination
// extraction + creation flow designed for each of their own models.
export const INBOUND_EMAIL_TYPE_PRESETS = [
  "Variation",
  "Site Instruction",
  "Programme change",
  "Scope of works addition/change",
  "General reference information",
  "Potential payment claim material",
  "Potential dispute/arbitration material"
] as const;
