import type { ExternalActionType } from "@prisma/client";

export const EXTERNAL_ACTION_TYPES: ExternalActionType[] = [
  "acknowledge",
  "approve",
  "sign",
  "confirm",
  "reject",
  "comment"
];

export const EXTERNAL_ACTION_TYPE_LABELS: Record<ExternalActionType, string> = {
  acknowledge: "Acknowledge",
  approve: "Approve",
  sign: "Sign",
  confirm: "Confirm",
  reject: "Reject",
  comment: "Comment"
};

// Shown to the SENDER when choosing a type, and to the RECIPIENT on the
// public response page — the "sign" wording here is the honesty guardrail
// itself: it must stay explicit every place this type is described, not
// just in one central spot, since a reader could land on either surface
// without having seen the other.
export const EXTERNAL_ACTION_TYPE_DESCRIPTIONS: Record<ExternalActionType, string> = {
  acknowledge: "Recipient confirms they've seen and understood this.",
  approve: "Recipient approves or rejects, with an optional comment.",
  sign: "Recipient types their name and ticks a confirmation box — a recorded acknowledgement with a timestamp, not a certified electronic signature.",
  confirm: "Recipient confirms the details are correct.",
  reject: "Recipient must give a reason.",
  comment: "Recipient leaves a free-text response only."
};

// Only these four types carry a genuine commercial "please approve this
// cost" ask — acknowledge/comment requests are about something else
// entirely and shouldn't be forced through the value-drafting flow. Kept
// in this client-safe constants file (not lib/external-action.ts, which
// imports Prisma) so client components can gate their UI on it without
// pulling server-only code into the browser bundle.
const VALUE_DRIVEN_TYPES: ExternalActionType[] = ["approve", "sign", "confirm", "reject"];

export function requiresValueSnapshot(type: ExternalActionType): boolean {
  return VALUE_DRIVEN_TYPES.includes(type);
}
