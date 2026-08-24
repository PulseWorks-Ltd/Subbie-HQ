import type { SafetyDocumentType } from "@prisma/client";

// Display order/labels for the closed SafetyDocumentType enum (Task 1.1) —
// kept here so the form dropdown, filter tabs, and card badge can never
// drift out of sync with each other.
export const SAFETY_DOCUMENT_TYPES: SafetyDocumentType[] = [
  "sssp",
  "hazard_register",
  "toolbox_talk",
  "induction",
  "incident_report",
  "other"
];

export const SAFETY_DOCUMENT_TYPE_LABELS: Record<SafetyDocumentType, string> = {
  sssp: "SSSP",
  hazard_register: "Hazard Register",
  toolbox_talk: "Toolbox Talk",
  induction: "Induction",
  incident_report: "Incident Report",
  other: "Other"
};
