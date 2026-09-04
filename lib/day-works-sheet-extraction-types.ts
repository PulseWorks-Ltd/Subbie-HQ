// Extracted out of app/api/projects/[projectId]/variation-items/[itemId]/
// day-works-sheets/[sheetId]/sheet-records/extract/route.ts — that file
// originally exported this type directly for other files to import,
// which fails Next.js's route-export-shape check ("next build"'s
// "Checking validity of types" step only allows HTTP method handlers and
// a small set of route config fields to be exported from an
// app/api/.../route.ts file). See lib/contract-schedule-schemas.ts for
// the first, fuller writeup of this same class of deploy-blocking bug.
export type DraftSheetRecord = {
  sheetNumber: string;
  teamLeaderCount: number;
  teamMemberCount: number;
  totalHours: number | null;
  date: string | null; // YYYY-MM-DD
  startTime: string | null;
  finishTime: string | null;
  task: string | null;
  notes: string | null;
  weather: string | null;
  location: string | null;
  confidence: number;
};
