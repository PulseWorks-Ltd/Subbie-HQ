// Common presets shown in the Incoming Emails review UI and given to Grok
// as suggestions — deliberately NOT a database enum. The type on
// InboundEmail/Correspondence is a plain string, so a new category can be
// typed in at any time without a schema migration.
//
// TODO (deferred, needs its own design pass): Variation/Site Instruction and
// QA are the only types today with a real structured filing destination
// (see fileInboundEmail's createVariationItem / createQaRecord — QA has no
// AI extraction step, just a direct stage-label + assignment). Other
// presets here — Programme change, Potential payment claim material — could
// eventually get the same treatment into their own modules (e.g. Programme,
// Payment Claims once that feature is built out), and categories not listed
// here at all (H&S, Contract, Evidence) would need a similar per-destination
// creation flow designed for each of their own models.
//
// "Day Works" (batch email-in) DOES have a real structured destination —
// see lib/inbound-day-works.ts and fileInboundEmail's createDayWorksExtraction
// flag. Classification is text-based (attachments[].extractedText), which is
// known to be unreliable for handwritten sheets — this preset only needs to
// get the human reviewer looking in the right place; the actual data
// extraction always uses the proven vision path once "Day Works batch" is
// chosen in the review dialog, never this classification step.
export const INBOUND_EMAIL_TYPE_PRESETS = [
  "Variation",
  "Site Instruction",
  "QA",
  "Day Works",
  "Programme change",
  "Scope of works addition/change",
  "General reference information",
  "Potential payment claim material",
  "Potential dispute/arbitration material"
] as const;
