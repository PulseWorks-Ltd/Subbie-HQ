import type { ClassifiedDocumentType, ExtractedLineItem } from "./grok";
import type { DraftSheetRecord } from "./day-works-sheet-extraction-types";

// Extracted out of app/api/projects/[projectId]/variation-items/[itemId]/
// labour-plant-material/classify/route.ts — see
// lib/contract-schedule-schemas.ts for the full writeup of why an
// app/api/.../route.ts file can't export anything besides its HTTP method
// handlers without failing Next.js's route-export-shape check.
export type ClassifiedFileResult = {
  fileName: string;
  storageKey: string;
  contentType: string;
  documentType: ClassifiedDocumentType;
  classificationConfidence: number;
  dayWorksSheets: DraftSheetRecord[];
  materialsLineItems: ExtractedLineItem[];
  plantLineItems: ExtractedLineItem[];
  error: string | null;
};
