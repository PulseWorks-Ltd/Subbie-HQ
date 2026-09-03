import OpenAI from "openai";
import { z } from "zod";
import { INBOUND_EMAIL_TYPE_PRESETS } from "./inbound-email-types";
import { recordAiUsageSuccess, recordAiUsageFailure, assertWithinSpendCap, type AiUsageContext } from "./ai-usage";

// Constructed lazily (not at module scope) — the OpenAI SDK validates apiKey
// presence eagerly in its constructor, which would crash Next.js's build-time
// page-data collection if this ran at import time with no key configured yet.
//
// timeout/maxRetries are set explicitly rather than left at the SDK's
// defaults (10 minutes, 2 retries) — a single slow/hung call could otherwise
// block a map-reduce Promise.all step for up to ~30 minutes before finally
// erroring.
//
// 90s was the original value, calibrated against small synthetic test
// payloads (a handful of clauses) — too aggressive in production, where a
// real subcontract can run 100-350+ clauses and every map-phase bucket call
// sends the FULL clause list (compareClausesToStandardBucket,
// compareClausesToPriorContract, extractContractTermsFromClauses,
// extractRequiredInsuranceCoverFromClauses all do this), producing a much
// larger prompt that genuinely needs more time, not a hang. Confirmed via a
// real 350-clause contract in production timing out at 90s. 5 minutes is
// generous enough for that scale while still bounded — combined with
// maxRetries: 1, a genuinely broken/hung call fails within ~10 minutes
// instead of the SDK's unbounded-by-us ~30.
function getClient() {
  return new OpenAI({
    apiKey: process.env.XAI_API_KEY,
    baseURL: "https://api.x.ai/v1",
    timeout: 300_000,
    maxRetries: 1
  });
}

// NOTE: xAI updates model names periodically — verify this is still current
// (https://docs.x.ai/docs/models) and adjust if the API starts returning a 404.
const GROK_MODEL = "grok-4-latest";

// The single low-level call site every live function in this file goes
// through — centralizes usage logging (lib/ai-usage.ts) so cost-calculation
// logic lives in exactly one place, never duplicated per function. Logs on
// BOTH success and failure (per the task brief's requirement that a failed
// call still records feature/org/user/timestamp/failure status), then
// re-throws the original error unchanged so every caller's existing
// try/catch behavior is untouched. Logging is awaited (not fire-and-forget)
// so a row is durably written before this returns — this data feeds a
// commercially-sensitive cost dashboard, not a best-effort audit trail.
async function callGrok(
  params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
  usageContext: AiUsageContext
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  try {
    await assertWithinSpendCap(usageContext.organisationId);
  } catch (capError) {
    await recordAiUsageFailure({ context: usageContext, model: params.model, error: capError });
    throw capError;
  }

  try {
    const response = await getClient().chat.completions.create(params);
    await recordAiUsageSuccess({
      context: usageContext,
      model: params.model,
      promptTokens: response.usage?.prompt_tokens ?? null,
      completionTokens: response.usage?.completion_tokens ?? null,
      totalTokens: response.usage?.total_tokens ?? null
    });
    return response;
  } catch (error) {
    await recordAiUsageFailure({ context: usageContext, model: params.model, error });
    throw error;
  }
}

const ExtractedSiteInstructionSchema = z.object({
  reference: z.string(),
  title: z.string(),
  notifiedAt: z.string().nullable(),
  dueAt: z.string().nullable(),
  summary: z.string()
});

export type ExtractedSiteInstruction = z.infer<typeof ExtractedSiteInstructionSchema>;

export async function extractSiteInstructionFromText(documentText: string): Promise<ExtractedSiteInstruction> {
  const response = await getClient().chat.completions.create({
    model: GROK_MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You extract structured data from construction Site Instructions / Notices to Subcontractor / Advice to Subcontractor documents. Respond with only a JSON object matching this exact shape: " +
          '{"reference": string, "title": string, "notifiedAt": string | null, "dueAt": string | null, "summary": string}. ' +
          "reference: the instruction/notice reference number exactly as printed, e.g. 'NTS 10055/500', 'ATS 4022/1280', 'SI-103', 'BUILT-SI-000088'. " +
          "title: a short heading summarizing what the instruction is about. " +
          "notifiedAt: the date the instruction was issued/dated (e.g. 'NTS Date', 'ATS Date', 'Issued Date', 'Created Date'), as an ISO 8601 date (YYYY-MM-DD), or null if not stated. " +
          "dueAt: the date a response, commencement, or completion is required by (e.g. 'Response Required', 'Due Date'), as an ISO 8601 date (YYYY-MM-DD), or null if not stated. " +
          "summary: a concise 1-3 sentence summary of what work or response is required."
      },
      {
        role: "user",
        content: documentText
      }
    ]
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("No response from Grok.");
  }

  return ExtractedSiteInstructionSchema.parse(JSON.parse(raw));
}

const ExtractedVariationItemSchema = z.object({
  reference: z.string(),
  title: z.string(),
  notifiedAt: z.string().nullable(),
  dueAt: z.string().nullable(),
  summary: z.string()
});

export type ExtractedVariationItem = z.infer<typeof ExtractedVariationItemSchema>;

export async function extractVariationItemFromText(
  documentText: string,
  itemType: "variation" | "site_instruction",
  usageContext: Omit<AiUsageContext, "feature">
): Promise<ExtractedVariationItem> {
  const documentKind =
    itemType === "variation"
      ? "a construction Variation notice or priced Variation quote"
      : "a construction Site Instruction / Notice to Subcontractor / Advice to Subcontractor document";

  const response = await callGrok({
    model: GROK_MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          `You extract structured data from ${documentKind}. Respond with only a JSON object matching this exact shape: ` +
          '{"reference": string, "title": string, "notifiedAt": string | null, "dueAt": string | null, "summary": string}. ' +
          "reference: the instruction/notice/variation reference number exactly as printed, e.g. 'NTS 10055/500', 'ATS 4022/1280', 'SI-103', 'V44', 'VAR-012'. " +
          "title: a short heading summarizing what the document is about. " +
          "notifiedAt: the date the document was issued/dated (e.g. 'NTS Date', 'Issued Date', 'Created Date'), as an ISO 8601 date (YYYY-MM-DD), or null if not stated. " +
          "dueAt: the date a response, commencement, or completion is required by (e.g. 'Response Required', 'Due Date'), as an ISO 8601 date (YYYY-MM-DD), or null if not stated. " +
          "summary: a concise 1-3 sentence summary of what work or response is required."
      },
      {
        role: "user",
        content: documentText
      }
    ]
  }, { ...usageContext, feature: "variation_site_instruction_extraction" });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("No response from Grok.");
  }

  return ExtractedVariationItemSchema.parse(JSON.parse(raw));
}

const ExtractedDayWorksSheetVisionSchema = z.object({
  sheetNumber: z.string().nullable(),
  teamLeaderCount: z.number().int().nullable(),
  teamMemberCount: z.number().int().nullable(),
  startTime: z.string().nullable(),
  finishTime: z.string().nullable(),
  // Kept as two separate model outputs rather than asking for a single
  // "totalHours" (see this feature's earlier OCR-then-regex version) —
  // real staging testing found that single ambiguous field regularly ended
  // up holding a per-person figure instead of the crew total, silently
  // undercounting cost. Splitting them lets code (not the model) verify
  // consistency in code below rather than trusting either number blindly.
  hoursPerPerson: z.number().nullable(),
  totalLabourHours: z.number().nullable(),
  date: z.string().nullable(),
  task: z.string().nullable(),
  weather: z.string().nullable(),
  location: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  notes: z.string().nullable()
});

const ExtractedDayWorksSheetsVisionSchema = z.object({
  sheets: z.array(ExtractedDayWorksSheetVisionSchema)
});

export type ExtractedDayWorksSheetSummary = {
  sheetNumber: string | null;
  teamLeaderCount: number | null;
  teamMemberCount: number | null;
  // Resolved crew-total hours — the AI's own stated total when present, a
  // crewSize × hoursPerPerson fallback when it isn't, or null if neither is
  // available (see the self-verification step below). This is what callers
  // should treat as "totalHours" for costing; hoursPerPerson itself is
  // intermediate and not exposed.
  totalHours: number | null;
  date: string | null;
  startTime: string | null;
  finishTime: string | null;
  task: string | null;
  notes: string | null;
  weather: string | null;
  location: string | null;
  confidence: number;
};

// Absolute-hours slack allowed between crewSize × hoursPerPerson and the
// sheet's own stated totalLabourHours before treating it as a genuine
// disagreement rather than rounding (e.g. a sheet stating "24.5" for a
// 3×8 crew). 10% relative is combined with this floor so larger crews/longer
// days get proportionally more slack too.
const LABOUR_TOTAL_MISMATCH_TOLERANCE_HOURS = 1;
const LABOUR_TOTAL_MISMATCH_CONFIDENCE_CAP = 0.35;

// Deliberately a per-SHEET summary, not a per-worker breakdown — see this
// feature's task notes. Reads the sheet image(s) directly with a
// vision-capable model rather than OCR-then-regex: real staging testing on
// actual handwritten sheets showed OCR producing unusable results (sheet
// numbers misread, headcounts stuck at 0, hours never extracted), because
// OCR answers "what characters can I read" when what's actually needed is
// "what is this form trying to communicate" — a document-understanding
// task a vision model handles far better, especially arithmetic statements
// like "3 MEN X 8 = 24" that OCR reliably mangles but a vision model reads
// as a statement of fact. A single uploaded file may bundle several
// physical sheets, so the model's actual job is to first detect how many
// distinct sheets are present, then produce one summary per sheet.
// Deliberately permissive about missing fields (null rather than a guess)
// since the caller always routes the result through a mandatory
// review-before-save step, never straight to the database.
export async function extractDayWorksSheetSummariesFromImages(
  images: { dataUrl: string }[],
  usageContext: Omit<AiUsageContext, "feature">
): Promise<ExtractedDayWorksSheetSummary[]> {
  const response = await callGrok(
    {
      model: GROK_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You read one or more photos/scans of construction Day Works Sheets, which are often handwritten, and extract a per-sheet SUMMARY. Look carefully at every number and word in the image(s) — do not guess from partial visibility. A single set of images may contain multiple distinct physical day works sheets bundled together (e.g. several pages, or several sheets photographed on one page) — first determine how many separate sheets are present, then produce exactly one summary object per sheet, in the order they appear. Do NOT extract a per-worker or per-time-entry breakdown; that level of detail is deliberately not wanted. Respond with only a JSON object matching this exact shape: " +
            '{"sheets": [{"sheetNumber": string | null, "teamLeaderCount": number | null, "teamMemberCount": number | null, "startTime": string | null, "finishTime": string | null, "hoursPerPerson": number | null, "totalLabourHours": number | null, "date": string | null, "task": string | null, "weather": string | null, "location": string | null, "confidence": number, "notes": string | null}]}. ' +
            "sheetNumber: the sheet's own reference/number exactly as printed or written (e.g. 'DW001', 'DW-15', 'Sheet 7', '23542'), or null if genuinely not shown — read every digit carefully, handwritten numbers are easy to misread. " +
            "teamLeaderCount: the number of foremen/leading hands/supervisors recorded on this sheet (usually 1), or null if not determinable. " +
            "teamMemberCount: the number of everyone else (regular workers) recorded on this sheet, or null if not determinable. " +
            "hoursPerPerson: the number of hours each individual worked, if stated or clearly consistent across the crew (e.g. '8' from '3 MEN X 8 HRS'), or null if not shown or not consistent. " +
            "totalLabourHours: the TOTAL labour hours across the whole crew for this sheet, ONLY if the sheet states its own total directly (e.g. '3 MEN X 8 = 24 HOURS' means 24) — never calculate this total yourself; if no such total is actually written on the sheet, leave this null and let hoursPerPerson carry the information instead. " +
            "startTime/finishTime/date/task/weather/location: extract only if clearly legible on the sheet; null if not shown — their absence is normal and never blocks extraction. " +
            "confidence: your own honest 0-1 confidence in the accuracy of THIS sheet's extraction as a whole — lower it for anything genuinely hard to read (poor handwriting, smudged ink, ambiguous digits); a field being genuinely blank on the sheet is normal and should NOT by itself lower confidence. " +
            "notes: a brief plain-English note on anything uncertain or unreadable on this sheet, so a human reviewer knows exactly what to double-check — null if nothing is uncertain. " +
            "Never guess or invent a number you can't reasonably support from what's visible — use null instead."
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Read the Day Works Sheet(s) in the following image(s) and extract the structured data described." },
            ...images.map((image) => ({ type: "image_url" as const, image_url: { url: image.dataUrl } }))
          ]
        }
      ]
    },
    { ...usageContext, feature: "day_works_sheet_extraction" }
  );

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("No response from Grok.");
  }

  const sheets = ExtractedDayWorksSheetsVisionSchema.parse(JSON.parse(raw)).sheets;
  return sheets.map(resolveDayWorksSheetSummary);
}

// Self-verification (deterministic, in code — never trust the model's own
// arithmetic): cross-checks crewSize × hoursPerPerson against the model's
// stated totalLabourHours when both are present, and falls back to
// computing the total from crewSize × hoursPerPerson when the sheet never
// stated one directly (Task 3.1's graceful-degradation rule). Extracted
// as its own function so classifyAndExtractDayWorksDocument (Labour,
// Plant & Material AI Extraction's unified per-file classify+extract
// call) reuses this exact verification logic rather than re-implementing
// it — the vision call/prompt that PRODUCES the raw sheet differs between
// the two callers, but the deterministic maths applied to the result
// never should.
function resolveDayWorksSheetSummary(
  sheet: z.infer<typeof ExtractedDayWorksSheetVisionSchema>
): ExtractedDayWorksSheetSummary {
  const crewSize =
    sheet.teamLeaderCount != null && sheet.teamMemberCount != null
      ? sheet.teamLeaderCount + sheet.teamMemberCount
      : null;

  let totalHours = sheet.totalLabourHours;
  let confidence = sheet.confidence;
  let notes = sheet.notes;

  if (totalHours == null) {
    if (crewSize != null && sheet.hoursPerPerson != null) {
      totalHours = crewSize * sheet.hoursPerPerson;
    }
  } else if (crewSize != null && sheet.hoursPerPerson != null) {
    const expected = crewSize * sheet.hoursPerPerson;
    const tolerance = Math.max(LABOUR_TOTAL_MISMATCH_TOLERANCE_HOURS, expected * 0.1);
    if (Math.abs(expected - totalHours) > tolerance) {
      confidence = Math.min(confidence, LABOUR_TOTAL_MISMATCH_CONFIDENCE_CAP);
      const mismatchNote = `Crew size × hours per person (${crewSize} × ${sheet.hoursPerPerson} = ${expected}) doesn't match the sheet's stated total (${totalHours}) — please verify.`;
      notes = notes ? `${notes} ${mismatchNote}` : mismatchNote;
    }
  }

  return {
    sheetNumber: sheet.sheetNumber,
    teamLeaderCount: sheet.teamLeaderCount,
    teamMemberCount: sheet.teamMemberCount,
    totalHours,
    date: sheet.date,
    startTime: sheet.startTime,
    finishTime: sheet.finishTime,
    task: sheet.task,
    notes,
    weather: sheet.weather,
    location: sheet.location,
    confidence
  };
}

// --- Labour, Plant & Material AI Extraction: unified per-file classify
// + extract (Task 4.1) ---

const DocumentTypeSchema = z.enum(["day_works_sheet", "materials_invoice", "plant_docket", "unknown"]);
export type ClassifiedDocumentType = z.infer<typeof DocumentTypeSchema>;

// Below this confidence, the caller treats the file as needing manual type
// assignment (Task 5) rather than trusting whatever the model extracted —
// same "don't blindly trust a low-confidence AI call" discipline as
// LOW_CONFIDENCE_THRESHOLD in the review dialogs, just gating "do we even
// show extracted data" rather than "do we visually flag a row."
export const DOCUMENT_CLASSIFICATION_CONFIDENCE_THRESHOLD = 0.6;

const ExtractedLineItemVisionSchema = z.object({
  description: z.string(),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  unitCost: z.number().nullable()
});
export type ExtractedLineItem = z.infer<typeof ExtractedLineItemVisionSchema>;

const ClassifyAndExtractSchema = z.object({
  documentType: DocumentTypeSchema,
  classificationConfidence: z.number().min(0).max(1),
  // Always all three arrays in the response (empty where not applicable)
  // rather than a discriminated shape — simpler, more reliable JSON mode
  // output than asking the model to omit whole keys conditionally.
  dayWorksSheets: z.array(ExtractedDayWorksSheetVisionSchema),
  materialsLineItems: z.array(ExtractedLineItemVisionSchema),
  plantLineItems: z.array(ExtractedLineItemVisionSchema)
});

export type ClassifyAndExtractResult = {
  documentType: ClassifiedDocumentType;
  classificationConfidence: number;
  dayWorksSheets: ExtractedDayWorksSheetSummary[];
  materialsLineItems: ExtractedLineItem[];
  plantLineItems: ExtractedLineItem[];
};

// One vision call per uploaded file (Task 4.1) — classifies the document,
// then extracts using whichever type-specific shape applies, all in a
// single round trip (never a separate classify-then-extract pair of
// calls). The day_works_sheet branch asks for exactly the same fields,
// with exactly the same wording, as extractDayWorksSheetSummariesFromImages'
// own prompt above — genuinely reused, not reinvented — and its result
// goes through the same resolveDayWorksSheetSummary self-verification
// step, so a file that resolves to day_works_sheet here behaves
// identically to one uploaded through the original single-purpose flow.
// materials_invoice/plant_docket are new extraction logic (Task 4.1) —
// simple line-item lists matching DayWorksMaterial/DayWorksPlant's own
// shape, deliberately with nullable quantity/unit/unitCost (never guess a
// number that isn't legible) since this always feeds a mandatory
// review-before-save step, never a direct save.
export async function classifyAndExtractDayWorksDocument(
  images: { dataUrl: string }[],
  usageContext: Omit<AiUsageContext, "feature">
): Promise<ClassifyAndExtractResult> {
  const response = await callGrok(
    {
      model: GROK_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You classify one uploaded construction site document (photo or scan) as exactly one of: \"day_works_sheet\" (a labour timesheet recording crew/hours worked, often handwritten), \"materials_invoice\" (a supplier invoice/receipt for materials purchased), \"plant_docket\" (a hire docket/invoice for plant or equipment hire), or \"unknown\" (doesn't clearly match any of those, or is too unclear to classify confidently). " +
            "Respond with only a JSON object matching this exact shape: " +
            '{"documentType": "day_works_sheet" | "materials_invoice" | "plant_docket" | "unknown", "classificationConfidence": number, "dayWorksSheets": [...], "materialsLineItems": [...], "plantLineItems": [...]}. ' +
            "classificationConfidence: your honest 0-1 confidence in the documentType classification itself. " +
            "Populate ONLY the array matching your classification; leave the other two as empty arrays. If documentType is \"unknown\" or your classificationConfidence is low, leave ALL THREE arrays empty — do not guess at extraction for a document you can't confidently identify. " +
            "\n\nIf documentType is \"day_works_sheet\", populate dayWorksSheets — one or more photos may contain multiple distinct physical day works sheets bundled together (e.g. several pages, or several sheets photographed on one page); first determine how many separate sheets are present, then produce exactly one summary object per sheet, in the order they appear. Do NOT extract a per-worker or per-time-entry breakdown; that level of detail is deliberately not wanted. Each entry: " +
            '{"sheetNumber": string | null, "teamLeaderCount": number | null, "teamMemberCount": number | null, "startTime": string | null, "finishTime": string | null, "hoursPerPerson": number | null, "totalLabourHours": number | null, "date": string | null, "task": string | null, "weather": string | null, "location": string | null, "confidence": number, "notes": string | null}. ' +
            "sheetNumber: the sheet's own reference/number exactly as printed or written (e.g. 'DW001', 'DW-15', 'Sheet 7', '23542'), or null if genuinely not shown — read every digit carefully, handwritten numbers are easy to misread. " +
            "teamLeaderCount: the number of foremen/leading hands/supervisors recorded on this sheet (usually 1), or null if not determinable. " +
            "teamMemberCount: the number of everyone else (regular workers) recorded on this sheet, or null if not determinable. " +
            "hoursPerPerson: the number of hours each individual worked, if stated or clearly consistent across the crew (e.g. '8' from '3 MEN X 8 HRS'), or null if not shown or not consistent. " +
            "totalLabourHours: the TOTAL labour hours across the whole crew for this sheet, ONLY if the sheet states its own total directly (e.g. '3 MEN X 8 = 24 HOURS' means 24) — never calculate this total yourself; if no such total is actually written on the sheet, leave this null and let hoursPerPerson carry the information instead. " +
            "startTime/finishTime/date/task/weather/location: extract only if clearly legible on the sheet; null if not shown — their absence is normal and never blocks extraction. " +
            "confidence: your own honest 0-1 confidence in the accuracy of THIS sheet's extraction as a whole — lower it for anything genuinely hard to read (poor handwriting, smudged ink, ambiguous digits); a field being genuinely blank on the sheet is normal and should NOT by itself lower confidence. " +
            "notes: a brief plain-English note on anything uncertain or unreadable on this sheet, so a human reviewer knows exactly what to double-check — null if nothing is uncertain. " +
            "\n\nIf documentType is \"materials_invoice\" or \"plant_docket\", populate materialsLineItems or plantLineItems respectively — one entry per distinct line item on the invoice/docket. Each entry: " +
            '{"description": string, "quantity": number | null, "unit": string | null, "unitCost": number | null}. ' +
            "description: the item/material or plant/equipment description exactly as printed. " +
            "quantity: the quantity/count for this line, or null if not clearly stated. " +
            "unit: the unit the quantity is measured in (e.g. 'each', 'm2', 'kg', 'day', 'hour'), or null if not clearly stated. " +
            "unitCost: the cost PER UNIT for this line (not the line's extended total) as a plain number with no currency symbols or commas, or null if only a total is shown and a per-unit rate can't be reliably derived. " +
            "Never guess or invent a number, description, or classification you can't reasonably support from what's visible — use null (or \"unknown\"/low confidence for the classification itself) instead."
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Classify the following document image(s) and extract the structured data described." },
            ...images.map((image) => ({ type: "image_url" as const, image_url: { url: image.dataUrl } }))
          ]
        }
      ]
    },
    { ...usageContext, feature: "labour_plant_material_document_extraction" }
  );

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("No response from Grok.");
  }

  const parsed = ClassifyAndExtractSchema.parse(JSON.parse(raw));

  return {
    documentType: parsed.documentType,
    classificationConfidence: parsed.classificationConfidence,
    dayWorksSheets: parsed.dayWorksSheets.map(resolveDayWorksSheetSummary),
    materialsLineItems: parsed.materialsLineItems,
    plantLineItems: parsed.plantLineItems
  };
}

const ExtractedProgrammeItemSchema = z.object({
  title: z.string(),
  description: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  confidence: z.number().min(0).max(1)
});

const ExtractedProgrammeSchema = z.object({
  filterApplied: z.boolean(),
  items: z.array(ExtractedProgrammeItemSchema)
});

export type ExtractedProgrammeItem = z.infer<typeof ExtractedProgrammeItemSchema>;
export type ExtractedProgrammeResult = z.infer<typeof ExtractedProgrammeSchema>;

export async function extractProgrammeFromText(
  documentText: string,
  tradeReference: string | undefined,
  usageContext: Omit<AiUsageContext, "feature">
): Promise<ExtractedProgrammeResult> {
  const filterInstruction = tradeReference
    ? "This programme may cover multiple trades/subcontractors, not just one. " +
      `Only extract activities belonging to the trade referenced as "${tradeReference}" — use judgement, not literal text matching. ` +
      `"${tradeReference}" could appear in the document in any of these forms, and you should recognise all of them as the same trade: ` +
      `(a) a short code or abbreviation against each activity, e.g. in a 'Trade', 'Responsible', or 'Contractor' column, or resolved via a legend/key mapping codes to company names; ` +
      `(b) a word with a different form, tense, or spelling than what was typed — e.g. if given "Scaffold", also match "Scaffolding", "Scaffolded", "Scaffold Erection", "Scaffold Hire" and similar variants; ` +
      `(c) a section or sub-heading in the document (e.g. a bold row reading "SCAFFOLDING") under which several unlabelled activity rows are grouped until the next heading — in that case every activity under the matching heading belongs to this trade, even though the individual rows don't repeat the trade name; ` +
      `(d) a synonym or closely related trade term a person in the industry would recognise as the same trade, even if the exact word differs. ` +
      `Set "filterApplied" to true if you found and used any of these signals to identify "${tradeReference}"'s activities. ` +
      `If the document gives no usable signal to attribute activities to a trade at all (e.g. it is already a single-trade programme with no headings or codes), extract every activity instead and set "filterApplied" to false.`
    : "Extract every distinct activity/milestone in the document, regardless of trade, and set \"filterApplied\" to false.";

  const response = await callGrok({
    model: GROK_MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You extract structured data from a construction project programme / schedule / works timetable document. " +
          "Respond with only a JSON object matching this exact shape: " +
          '{"filterApplied": boolean, "items": [{"title": string, "description": string | null, "startDate": string | null, "endDate": string | null, "confidence": number}]}. ' +
          "Each item is one discrete activity or milestone in the programme (e.g. 'Erect scaffold', 'Pour ground floor slab', 'Roof cladding complete'). " +
          "title: a short label for the activity, as close to the document's own wording as possible. " +
          "description: any extra detail/notes for the activity, or null if none. " +
          "startDate: the activity's planned start date as an ISO 8601 date (YYYY-MM-DD), or null if not stated. " +
          "endDate: the activity's planned completion/end date as an ISO 8601 date (YYYY-MM-DD), or null if not stated. " +
          "confidence: your confidence (0 to 1) that you read this activity's title and dates correctly from the document. " +
          filterInstruction +
          " List activities in the order they appear in the document."
      },
      {
        role: "user",
        content: documentText
      }
    ]
  }, { ...usageContext, feature: "programme_extraction" });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("No response from Grok.");
  }

  return ExtractedProgrammeSchema.parse(JSON.parse(raw));
}

const ExtractedContractClauseSchema = z.object({
  clauseRef: z.string(),
  title: z.string().nullable(),
  body: z.string(),
  pageNumber: z.number().int().nullable()
});
const ExtractedContractClausesSchema = z.object({ clauses: z.array(ExtractedContractClauseSchema) });

export type ExtractedContractClause = z.infer<typeof ExtractedContractClauseSchema>;

// Step 0 of the contract review pipeline — extracts every numbered clause,
// verbatim, from one page-chunk of an uploaded subcontract. Called once per
// ~8-page batch by the review route (mirrors the SA-2017 baseline's own
// page-chunked extraction in scripts/generate-standard-form-baseline.mjs, so
// both sides of the later comparison are built the same careful way).
export async function extractContractClausesFromText(
  documentText: string,
  usageContext: Omit<AiUsageContext, "feature">
): Promise<ExtractedContractClause[]> {
  const response = await callGrok({
    model: GROK_MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You extract every individually-numbered clause, verbatim, from an excerpt of a construction subcontract agreement. " +
          "Respond with only a JSON object matching this exact shape: " +
          '{"clauses": [{"clauseRef": string, "title": string | null, "body": string, "pageNumber": number | null}]}. ' +
          "clauseRef: the clause's printed number or label exactly as shown, e.g. '5.9.1', '8.4.2', '16.1.1', 'Special Condition 3'. If a passage has no visible number, give it a short descriptive label instead of inventing a number. " +
          "title: a short heading for the clause if the document gives one nearby, else null. " +
          "body: the clause's full text, verbatim — do not summarize, paraphrase, or omit any clause in this excerpt, however minor. " +
          "pageNumber: the text below contains '--- PAGE N ---' markers showing where each source page begins — use the marker immediately before the clause to report its correct page number. Never guess a page number from the clause's numbering; only use the markers, and use null if no marker precedes the clause. " +
          "Extract every clause in this excerpt, including short or seemingly minor ones."
      },
      { role: "user", content: documentText }
    ]
  }, { ...usageContext, feature: "contract_review" });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("No response from Grok.");
  }

  return ExtractedContractClausesSchema.parse(JSON.parse(raw)).clauses;
}

const DeviationClassificationSchema = z.enum([
  "matches_standard",
  "minor_deviation",
  "major_deviation",
  "missing_from_subcontract",
  "additional_in_subcontract"
]);

const BucketDeviationSchema = z.object({
  // .nullish() (not .nullable()) — the reduce/synthesis phase (see
  // SynthesisDeviationSchema below) asks the model to re-emit these fields a
  // second time, and it sometimes omits the key entirely for legitimately-
  // null entries (e.g. additional_in_subcontract has no baselineClauseTitle)
  // instead of writing an explicit null. .nullable() rejects that missing
  // key with a ZodError and crashes the whole review; .nullish() accepts both.
  baselineClauseRef: z.string().nullish(),
  baselineClauseTitle: z.string().nullish(),
  subcontractClauseRef: z.string().nullish(),
  subcontractExcerpt: z.string().nullish(),
  classification: DeviationClassificationSchema,
  impact: z.enum(["low", "medium", "high"]),
  rationale: z.string(),
  recommendation: z.string().nullish()
});
const BucketComparisonResultSchema = z.object({ deviations: z.array(BucketDeviationSchema) });

export type BucketDeviation = z.infer<typeof BucketDeviationSchema>;

type ClauseLike = { clauseRef: string; title: string | null; body: string };

function formatClausesForPrompt(clauses: ClauseLike[]): string {
  return clauses.map((c) => `[${c.clauseRef}]${c.title ? ` ${c.title}` : ""}\n${c.body}`).join("\n\n");
}

// Step 1 (map phase) — one call per baseline topicBucket. Given that bucket's
// SA-2017 clauses plus the FULL extracted subcontract clause list (sending
// everything, not a pre-filtered subset, so nothing is silently dropped by a
// fallible pre-sort), finds and classifies every deviation for this bucket's
// topics, including subcontract clauses with no standard-form counterpart at
// all (additional_in_subcontract — the highest-risk case, an MC-added clause).
export async function compareClausesToStandardBucket(
  bucketLabel: string,
  baselineClauses: ClauseLike[],
  subcontractClauses: ClauseLike[],
  usageContext: Omit<AiUsageContext, "feature">
): Promise<BucketDeviation[]> {
  const baselineText = formatClausesForPrompt(baselineClauses);
  const subcontractText = formatClausesForPrompt(subcontractClauses);

  const response = await callGrok({
    model: GROK_MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          `You are comparing an uploaded subcontract agreement against the "${bucketLabel}" section of the SA-2017 standard-form NZ subcontract agreement, to flag deviations that shift risk or liability onto the subcontractor. ` +
          "The subcontract's clause numbers will NOT correspond to the standard form's — match clauses by what they actually say and require, not by label. " +
          "For every standard-form clause below, carefully check whether the subcontract contains a clause covering the same subject matter, and if so whether its substance matches, is a minor (wording/technical/administrative) deviation, or is a major deviation (changes obligations, liability, risk allocation, deadlines, amounts, or removes a protection). " +
          "Also separately check whether the subcontract contains any clause on this section's topic that has NO counterpart at all in the standard form below (an added, onerous clause) — these are exactly as important to flag as missing/altered clauses. " +
          "Respond with only a JSON object matching this exact shape: " +
          '{"deviations": [{"baselineClauseRef": string | null, "baselineClauseTitle": string | null, "subcontractClauseRef": string | null, "subcontractExcerpt": string | null, "classification": "matches_standard" | "minor_deviation" | "major_deviation" | "missing_from_subcontract" | "additional_in_subcontract", "impact": "low" | "medium" | "high", "rationale": string, "recommendation": string | null}]}. ' +
          "classification: matches_standard = substantively the same as the standard form; minor_deviation = differs but low practical impact (wording, formatting, minor timing/admin tweaks); major_deviation = differs in a way that meaningfully changes risk, liability, obligations, deadlines, or amounts; missing_from_subcontract = a standard-form protection for the subcontractor that this subcontract has removed or weakened with no replacement; additional_in_subcontract = a clause in the subcontract on this topic with no standard-form counterpart at all. " +
          "baselineClauseRef/baselineClauseTitle: the standard-form clause being compared, or null for additional_in_subcontract. " +
          "subcontractClauseRef/subcontractExcerpt: the matching subcontract clause reference and a short verbatim excerpt (not the full text), or null for missing_from_subcontract. " +
          "impact: your assessment of how much this specific deviation shifts risk/liability onto the subcontractor — low/medium/high. Always low for matches_standard. " +
          "rationale: 1-2 plain-English sentences explaining the deviation and why it matters (or briefly confirming it matches). " +
          "recommendation: a short, practical suggestion for the subcontractor (e.g. what to query or negotiate), or null if none needed. " +
          "Include one entry per standard-form clause below (even matches_standard ones — keep those brief), plus any additional_in_subcontract entries you find. Be thorough — do not skip any standard-form clause in this section."
      },
      {
        role: "user",
        content: `STANDARD FORM CLAUSES (${bucketLabel}):\n${baselineText}\n\n---\n\nSUBCONTRACT CLAUSES (full document, for matching against this section):\n${subcontractText}`
      }
    ]
  }, { ...usageContext, feature: "contract_review" });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("No response from Grok.");
  }

  return BucketComparisonResultSchema.parse(JSON.parse(raw)).deviations;
}

// Fixed, closed set — must match prisma/schema.prisma's FindingCategory
// enum exactly. The prompt instructs the model never to invent a category
// outside this list, but real-world output isn't 100% reliable (confirmed:
// a defects/rectification clause once came back as the model's own invented
// "defects" string instead of "final_account") — .catch("other") means an
// invalid value degrades to the rare-fallback category instead of a
// ZodError crashing the entire review. Same "tolerate real model output
// rather than reject it" principle already applied elsewhere in this file
// (see BucketDeviationSchema's .nullish() comment).
const FindingCategorySchema = z
  .enum([
    "payment_cash_flow",
    "variations",
    "notices_time_bars",
    "programme_delay",
    "liability_indemnity",
    "insurance",
    "administration_documentation",
    "health_safety",
    "intellectual_property",
    "final_account",
    "termination",
    "site_facilities_operations",
    "other"
  ])
  .catch("other");

// Must match prisma/schema.prisma's FindingSeverity enum exactly.
const FindingSeveritySchema = z.enum(["critical", "important", "informational"]);

// category/severity are new (Contract Review redesign Phase 1) — added only
// here, at the synthesis/reduce step, not in BucketDeviationSchema (the map
// phase). The reduce call already sees every deviation across the WHOLE
// contract at once, which is what makes consistent categorization possible
// (e.g. every insurance-related finding from different SA-2017 buckets
// lands in the same category) — doing this per-bucket in the map phase
// would risk each bucket call categorizing inconsistently with the others.
const SynthesisDeviationSchema = BucketDeviationSchema.extend({
  topicBucket: z.string(),
  priorityScore: z.number().int().min(0).max(100),
  category: FindingCategorySchema,
  severity: FindingSeveritySchema
});
// Phase 1.5 additions — no length bounds enforced at the schema level
// (deliberately, matching this file's established .nullish()-over-strict
// lesson: a model that returns 2 or 7 items instead of the prompted
// "roughly 3-6" shouldn't crash the whole review). Prompt-level guidance
// only, not a hard contract.
const PositiveFindingSchema = z.object({ title: z.string(), context: z.string() });

// Phase 1.75 — category-level synthesis (Task 1.1). Keyed by category
// string in the response object rather than nested under each deviation,
// since this is ONE summary per category, not per finding. Key schema is
// deliberately a plain z.string(), not FindingCategorySchema — a record's
// key validator has no equivalent of .catch() to fall back to "other" per
// key, so an unrecognised key would otherwise fail the whole parse; any
// key that isn't a real category is simply ignored when read (see
// parseCategorySummaries in deviation-report-view.tsx), same
// tolerate-real-model-output principle as BucketDeviationSchema's
// .nullish() and FindingCategorySchema's .catch("other").
const CategorySummarySchema = z.object({
  whatThisMeans: z.string(),
  keyRisks: z.array(z.string()),
  protectYourself: z.array(z.string())
});

const SynthesisResultSchema = z.object({
  executiveSummary: z.string(),
  overallRiskLevel: z.enum(["low", "medium", "high"]),
  // Short, specific, contract-derived facts grounding the executive
  // summary (e.g. "6 payment preconditions") — see the prompt below.
  keyObservations: z.array(z.string()),
  // Genuine retained/favourable provisions, drawn only from matchedClauses
  // (see synthesizeContractReview) — legitimately empty when nothing
  // material is retained; never padded to hit a quota.
  positiveFindings: z.array(PositiveFindingSchema),
  // Optional (not defaulted to {}) so a model response that omits it
  // entirely doesn't crash the parse — synthesizeContractReview below
  // normalizes a missing value to {} before returning, so callers never
  // have to handle undefined themselves.
  categorySummaries: z.record(z.string(), CategorySummarySchema).optional(),
  deviations: z.array(SynthesisDeviationSchema)
});

export type SynthesisDeviation = z.infer<typeof SynthesisDeviationSchema>;
export type SynthesisResult = z.infer<typeof SynthesisResultSchema>;

// Step 2 (reduce phase) — one call. Takes every non-matching deviation
// already found and classified by the map phase (small, structured records,
// not raw legal text) and produces the prioritized, summarized report: an
// executive summary, an overall risk level, and per-deviation priorityScore,
// category, and severity (Contract Review redesign Phase 1), plus
// keyObservations and positiveFindings (Phase 1.5) — see
// components/contract/deviation-report-view.tsx for how these drive the
// grouped/severity-sorted results page. No new AI call, either phase —
// this is the same single reduce call enriched with a richer output schema.
// comparisonLabel describes what the subcontract was compared against —
// "the SA-2017 standard-form baseline" for baseline reviews, or "their
// previous contract with this Main Contractor" for prior_contract reviews
// (see lib/contract-comparison.ts) — the prompt/wording adapts either way.
export async function synthesizeContractReview(
  bucketResults: { topicBucket: string; deviations: BucketDeviation[] }[],
  comparisonLabel: string | undefined,
  usageContext: Omit<AiUsageContext, "feature">
): Promise<SynthesisResult> {
  comparisonLabel = comparisonLabel ?? "the SA-2017 standard-form baseline";
  const relevant = bucketResults.flatMap(({ topicBucket, deviations }) =>
    deviations
      .filter((deviation) => deviation.classification !== "matches_standard")
      .map((deviation) => ({ ...deviation, topicBucket }))
  );
  // Phase 1.5 — previously only counted (matchCounts) and discarded; the
  // map phase already produces real content for these (baselineClauseRef/
  // Title, subcontractClauseRef, a brief rationale confirming the match —
  // see compareClausesToStandardBucket's prompt), so this is the existing
  // clause-matching data reused as-is, not a new comparison pass. This is
  // the ONLY source positiveFindings may draw from (see prompt below).
  const matchedClauses = bucketResults.flatMap(({ topicBucket, deviations }) =>
    deviations
      .filter((deviation) => deviation.classification === "matches_standard")
      .map((deviation) => ({
        topicBucket,
        baselineClauseRef: deviation.baselineClauseRef,
        baselineClauseTitle: deviation.baselineClauseTitle,
        subcontractClauseRef: deviation.subcontractClauseRef,
        rationale: deviation.rationale
      }))
  );

  async function runSynthesisCall(): Promise<SynthesisResult> {
    const response = await callGrok({
      model: GROK_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
          `You are prioritizing, categorizing, and summarizing a list of already-classified deviations found between a subcontract agreement and ${comparisonLabel}, for a subcontractor to review quickly without missing anything important. ` +
          "Respond with only a JSON object matching this exact shape: " +
          '{"executiveSummary": string, "overallRiskLevel": "low" | "medium" | "high", "keyObservations": string[], "positiveFindings": [{"title": string, "context": string}], "categorySummaries": {"<category>": {"whatThisMeans": string, "keyRisks": string[], "protectYourself": string[]}, ...}, "deviations": [{"topicBucket": string, "baselineClauseRef": string | null, "baselineClauseTitle": string | null, "subcontractClauseRef": string | null, "subcontractExcerpt": string | null, "classification": string, "impact": "low" | "medium" | "high", "priorityScore": number, "category": string, "severity": "critical" | "important" | "informational", "rationale": string, "recommendation": string | null}]}. ' +
          `executiveSummary: 2-4 sentences, plain English, giving the overall picture (the general character of the changes, whether this looks like a lightly-modified or heavily-modified version of ${comparisonLabel}, and where the real risk concentrates) — most subcontractors can't meaningfully renegotiate these contracts, so focus on what this contract actually requires of them rather than leading with "you should negotiate this." ` +
          `overallRiskLevel: your overall assessment of how much this subcontract shifts risk onto the subcontractor compared to ${comparisonLabel}. ` +
          "keyObservations: a short bullet list (roughly 3-6 items) of SPECIFIC, CONCRETE facts you observed while reviewing the deviations below — e.g. \"6 payment preconditions\", \"4 shortened notice periods\", \"3 expanded liability clauses\". These are short phrases, not full sentences, and each one must be a genuine count or pattern you can point back to in the deviations you were given — never state a number you haven't actually verified against the input, and never just restate a category name generically (\"payment issues\" is not an observation; \"6 payment preconditions\" is). Do not use a fixed list of observation types — describe whatever specific, real patterns THIS contract actually shows; a different contract will have different notable patterns. " +
          "positiveFindings: 3-5 genuine positive findings — provisions that remain standard, unchanged, or favourable to the subcontractor compared to " +
          `${comparisonLabel}. Draw these ONLY from the matchedClauses list below (never invent one, never draw from the deviations list — those are by definition not matches). Each has a "title" (a short label naming the retained provision, e.g. "Standard SA-2017 variation process retained") and a "context" (one plain-English sentence explaining what this means for the subcontractor). Prioritise matches on commercially significant topics (payment, variations, liability, insurance, time bars, termination) over purely administrative or definitional matches, unless nothing more significant is available. ` +
          "CRITICAL: do not force this to hit a quota. If matchedClauses contains few or no clauses that are genuinely material or favourable to highlight, return fewer than 3, or an empty array — a heavily-modified contract with little retained in the subcontractor's favour should genuinely show few or zero positive findings. Never pad this list with weak, generic, trivial, or misleading reassurance just to have something to show. " +
          "For each input deviation, include it in the output with the same fields plus a priorityScore (0-100, higher = more important for the subcontractor to read first) — major_deviation, missing_from_subcontract, and additional_in_subcontract entries should generally score higher than minor_deviation entries, but weigh actual practical impact (e.g. a 'minor'-labelled clause about a large retention change should still score highly). " +
          'category: classify each deviation into EXACTLY ONE of these fixed categories — respond with ONLY one of these exact strings, never a different word or a category of your own invention: "payment_cash_flow" (payment claims, payment schedules, retention, set-off), "variations" (variation instructions, pricing, notice requirements for variations), "notices_time_bars" (notice periods and conditions precedent for claims generally, time bar clauses), "programme_delay" (extensions of time, delay damages, programme obligations), "liability_indemnity" (liability caps, indemnities, consequential loss, warranties), "insurance" (required insurance types and cover levels), "administration_documentation" (record-keeping, reporting, shop drawings, QA/QC documentation), "health_safety" (site safety, H&S management plans, PPE, incident reporting), "intellectual_property" (design IP, ownership of drawings/documents), "final_account" (final payment claim, defects, defects liability period, rectification of defective work, release of retention), "termination" (termination rights and consequences, suspension), "site_facilities_operations" (physical/operational site obligations — scaffolding, cleaning, hoisting, power supply, water supply, welfare facilities such as site offices/toilets/lunch rooms, sub-letting consent, site access, lighting, marking-out/set-out responsibility, and similar day-to-day site logistics that aren\'t about payment, programme, liability, insurance, admin, or H&S). ' +
          '"other" is a rare, genuine last resort — use it ONLY if a deviation truly does not fit any of the 12 categories above even on reflection, never as a default just because a finding doesn\'t obviously match one of the more common categories at first glance. Before assigning "other", check specifically whether the finding is really a site-operational obligation ("site_facilities_operations") — that is the category most often wrongly missed in favour of "other". A well-classified contract should have few or zero "other" findings, not a large minority of them. ' +
          "severity: assess the deviation's genuine commercial impact on the subcontractor, not just whether it differs from the comparison — most deviations are NOT critical, so use the full range rather than defaulting to critical. " +
          "ALGORITHM — follow both steps, in order, for EVERY SINGLE deviation individually, no exceptions: " +
          "STEP 1 — classify the FACT ITSELF from THIS deviation's own rationale (ignore every other deviation while doing this step) into exactly one type: (a) MISSING-ENTIRELY — a whole requirement, right, or protection type present in the baseline has NO counterpart at all in the subcontract (e.g. no professional indemnity insurance at all, no joint-insured requirement at all, no notice mechanism at all); (b) QUANTITATIVE-CHANGE — the SAME requirement type exists in both, just with a different NUMBER — a dollar amount, a percentage, a day count, or a duration (e.g. $1,000,000 vs $5,000,000, 5% vs 10%, 6 months vs 12 months, 20 working days vs 10 working days); (c) ADDED-REQUIREMENT — a brand-new obligation or restriction on the subcontractor exists in the subcontract with no baseline counterpart at all (the reverse of MISSING-ENTIRELY). " +
          "STEP 2 — apply DIRECTION based on the type from Step 1: for (a) MISSING-ENTIRELY and (c) ADDED-REQUIREMENT, these CAN be critical if they genuinely increase the subcontractor's risk, cost, or burden (usually true — a real missing protection or a real new burden). For (b) QUANTITATIVE-CHANGE, compare the two numbers directly: if the subcontractor's number is smaller/easier/more time (a lower amount required of them, a lower percentage withheld from them, a longer deadline given to them), this is a REDUCED burden and MUST be informational or at most important, NEVER critical — this holds NO MATTER HOW MANY MISSING-ENTIRELY siblings about the same broad topic surround it in the same category. A cluster of genuinely-critical missing-coverage findings sitting next to one QUANTITATIVE-CHANGE reduction does not make that one reduction critical too — each deviation is scored on its own Step-1 classification alone. " +
          "Worked examples — get ALL of these right, this principle applies broadly, not just to the insurance case: " +
          "(1) SA-2017 requires public liability insurance of not less than $5,000,000; this subcontract requires only $1,000,000. The number is smaller, but the DEMAND ON THE SUBCONTRACTOR is smaller too — they need to buy less insurance, which is cheaper and easier to satisfy. Informational or at most important, never critical. Do NOT reason that a lower required minimum is 'critical' because a large claim might exceed it — that is reasoning about a hypothetical downstream insurance-adequacy scenario, not about what this contract actually demands of the subcontractor, and is the wrong analysis. THIS SPECIFIC MISTAKE IS THE MOST COMMON ERROR IN PAST REVIEWS — watch for yourself writing a rationale containing phrases like 'shifting risk/exposure to the subcontractor', 'increasing the subcontractor's uninsured exposure', or 'leaves the subcontractor more exposed' about a reduced insurance minimum with nothing else stated. If your OWN draft rationale for a bare reduced-minimum deviation contains reasoning like this, that is the exact wrong analysis being described right now — rewrite the rationale to state plainly that this is a reduced requirement, and set severity to informational or important, never critical. " +
          "(2) SA-2017 sets a 12-month Defects Liability Period; this subcontract sets 6 months. This is HALF the time the subcontractor is on the hook for defects after Practical Completion — a reduced burden. Informational or at most important, never critical, even though \"defects liability period\" sounds like a significant topic. " +
          "(3) SA-2017 sets retention at 10% of each payment claim; this subcontract sets 5%. Less money is withheld from the subcontractor at every claim — a reduced burden. Informational or at most important, never critical, even though retention is a payment-category topic. " +
          "(4) SA-2017 requires the subcontractor to give notice of a delay within 10 working days; this subcontract allows 20 working days. More time to comply is a reduced burden on the subcontractor — informational or at most important, never critical. (Note the topic is identical to a genuinely critical scenario in the other direction: a SHORTENED notice period the subcontractor must meet IS a real, common, critical burden increase. Only the direction differs — the topic name alone never decides this.) " +
          "MIXED-SIGNAL CASE — this is where this rule is most often gotten wrong in practice: sometimes a single deviation's rationale mentions a reduced number AND some other omitted or unaddressed detail in the same breath (e.g. \"$1M instead of $5M minimum, and omits third-party property scope wording\"). Do not let the mere presence of an omission phrase pull the severity up to critical by association. Evaluate that OTHER detail independently: is it really a genuinely significant, separate gap — e.g. an entire insurance TYPE missing altogether, not just a lower number or missing procedural/definitional wording? If not, the deviation is still fundamentally a reduced requirement and must stay informational or important. Only let an accompanying detail justify critical if THAT detail, considered on its own, would independently qualify as critical by the definition below. " +
          '"critical" = directly affects payment, variations, extensions of time, termination, liability, indemnities, time bars, waivers, insurance coverage gaps, IP ownership, retention, or the final account, AND genuinely INCREASES the subcontractor\'s risk, cost, or burden compared to the comparison — being one of these TOPICS is necessary but never sufficient; a reduced-burden deviation on any of these topics is still not critical. ' +
          '"important" = operational obligations — safety, cleaning, power, water, site coordination, hoisting, shop drawings, QA processes, programme administration — or a commercial-category deviation (as listed for "critical" above) that only moderately increases risk. ' +
          '"informational" = minor wording changes, definitions, cross-references, formatting, procedural differences that don\'t meaningfully change commercial risk either way, OR any deviation (in any category) that reduces or leaves unchanged the subcontractor\'s risk, cost, or burden. ' +
          "INDEPENDENCE ACROSS DEVIATIONS — a concrete, common scenario, get this right: the input below will often contain roughly 10-15 separate insurance deviations from ONE subcontract clause being compared against SA-2017's many granular insurance sub-clauses. MOST of them will genuinely be critical, because they each describe an entire insurance TYPE missing altogether (no contract works insurance, no professional indemnity, no motor vehicle cover, no joint-insured requirement, etc — each a real, independent gap). Do NOT let that surrounding cluster of genuinely-critical siblings pull up the severity of the ONE deviation among them whose OWN rationale is purely 'the required minimum/limit is a smaller number than SA-2017's (e.g. $1,000,000 instead of $5,000,000), with no other detail stated'. That specific one stays informational or important even though ten siblings right next to it about the same broad insurance topic are correctly critical — judge every deviation SOLELY on what its own rationale states, never by proximity or topic-clustering with other findings. Two deviations about the same clause can, correctly, end up with different severities from each other. " +
          "SELF-CONSISTENCY ON DUPLICATES: the map phase sometimes produces several near-duplicate deviations that all restate the EXACT SAME bare quantitative fact (e.g. three separate entries that each just say the public liability minimum is $1,000,000 instead of $5,000,000, with no other independent detail in any of them, only worded slightly differently or referencing slightly different baseline sub-clause numbers). These near-duplicates must all receive the SAME severity as each other, because they describe the identical fact — if you correctly judge one of these bare-fact duplicates as informational or important, do not separately judge another near-duplicate restating the identical bare fact as critical. Before finalizing, scan for this exact situation (multiple deviations reducible to the same one bare number-vs-number fact) and make sure your severities for them agree with each other. " +
          "FINAL CHECK before you finalize each deviation's severity: re-read the direction you determined for it. If it is a reduced or eased burden on the subcontractor, critical is not a valid answer for that deviation — no matter which topic it falls under (insurance, retention, defects, time bars, payment, or any other). Topic alone never overrides direction. " +
          "categorySummaries (Phase 1.75): for EVERY category that has at least one deviation in your output above, add ONE entry containing: " +
          "The key for each entry MUST be one of these exact 13 strings and NO OTHERS: \"payment_cash_flow\", \"variations\", \"notices_time_bars\", \"programme_delay\", \"liability_indemnity\", \"insurance\", \"administration_documentation\", \"health_safety\", \"intellectual_property\", \"final_account\", \"termination\", \"site_facilities_operations\", \"other\" — i.e. the exact same value you assigned in that deviation's own \"category\" field above. " +
          'Do NOT key categorySummaries by "topicBucket" — topicBucket is a DIFFERENT field (the SA-2017 section a clause came from, e.g. "payments", "time", "defects", "general_obligations", "indemnity_insurance") and is NOT one of the 13 valid keys here. Get this right: a deviation with topicBucket "payments" and category "payment_cash_flow" belongs under the categorySummaries key "payment_cash_flow", never under "payments". ' +
          '\"whatThisMeans\" — 2-4 paragraphs of plain English synthesizing what the changes in THIS CATEGORY commercially mean for the subcontractor\'s business as a whole (e.g. what a cluster of payment-related deviations together does to their cash flow), written at the category level — never a clause-by-clause recap of the individual findings underneath. ' +
          '\"keyRisks\" — a short bullet list (roughly 3-6 items) of the category\'s main risks, synthesized ACROSS its findings, not one bullet per finding. ' +
          '\"protectYourself\" — a short bullet list (roughly 3-6 items) of practical compliance actions at the category level. Where a specific Subbie HQ feature is a genuine, accurate fit for one of these actions, name it — Variations, Day Works Sheets, Updates, Pictures, Correspondence, Health & Safety, Payment Claims — but only when it is a real fit for what you\'re recommending, never by default or to pad the list. ' +
          "CRITICAL — categorySummaries must be genuinely HIGHER-LEVEL than the deviations list, not a restatement of it. keyRisks and protectYourself must be a SMALLER, MORE CONSOLIDATED set of points than the individual findings underneath — if a category has 26 findings, keyRisks distills the handful of underlying THEMES across those 26, it does not list 26 (or even 10) near-duplicates of each finding's own rationale or recommendation. " +
          "Worked example — get this right: if Payment & Cash Flow has separate findings for '10 additional payment preconditions', 'retention increased from 5% to 10%', 'payment claim deadline shortened from 20 to 10 working days', and '3 new set-off rights for the Main Contractor', a BAD keyRisks list restates all four almost verbatim as four bullets. A GOOD keyRisks list synthesizes the theme into far fewer points — e.g. a single bullet like 'Getting paid depends on clearing more preconditions, happens more slowly, and more of what's claimed can be withheld or offset' — consolidating multiple findings into fewer, higher-level points a subcontractor can actually hold in their head, the same relationship clause-level detail already has to the executiveSummary above. " +
          "categorySummaries must NEVER use live or real-time status language. Do not say or imply the subcontractor currently IS or IS NOT compliant, do not use words like \"currently\", \"right now\", or any status/traffic-light framing — you have no visibility into the actual state of this specific project. Only describe what the CONTRACT requires and how to protect against that requirement in general (e.g. \"Track site instructions in writing before starting extra work\", never \"You are not currently tracking site instructions\"). " +
          "Do not invent new deviations or drop any of the input deviations — reorder, categorize, and score them, do not filter them out."
      },
        {
          role: "user",
          content: JSON.stringify({ deviations: relevant, matchedClauses })
        }
      ]
    }, { ...usageContext, feature: "contract_review" });

    const raw = response.choices[0]?.message?.content;
    if (!raw) {
      throw new Error("No response from Grok.");
    }

    return SynthesisResultSchema.parse(JSON.parse(raw));
  }

  let result = await runSynthesisCall();

  // Integrity guard — confirmed in production (2026-08-03, review
  // cmsdub98m00069trgycqrh83c): given 270 real map-phase deviations as
  // input, this call returned a syntactically valid, schema-passing
  // response with a fully-written executiveSummary, keyObservations,
  // positiveFindings, and all 12 categorySummaries populated — but its own
  // "deviations" array was empty. That response was persisted and shown to
  // a real user as a normal "complete" review: a confident, specific
  // narrative sitting on top of zero actual ContractDeviation rows, with
  // no category breakdown and 0/0/0 severity counts, and nothing in the
  // pipeline detected the inconsistency. AI usage logs for that run showed
  // every call succeeding — this isn't a transport/parsing failure, the
  // model's own response was self-contradictory. relevant.length > 0 is
  // the exact, narrowly-scoped condition that failure exhibited (a real,
  // non-empty input echoed back as an empty array) — deliberately not a
  // stricter count-matching check, since there's no evidence minor
  // under-counts are a real problem, only total wipeouts. One retry is
  // cheap and recovers a transient case; a second failure is treated as a
  // genuine pipeline failure (propagates to runContractReviewWork's
  // existing catch, marking the review "failed" with a clear message)
  // rather than ever silently persisting ungrounded narrative content
  // again.
  if (relevant.length > 0 && result.deviations.length === 0) {
    result = await runSynthesisCall();
    if (relevant.length > 0 && result.deviations.length === 0) {
      throw new Error(
        "The AI review generated a summary but no supporting deviation details for this contract — this looks like an unreliable response rather than a genuinely clean contract. Please try running the review again."
      );
    }
  }

  return result;
}

const ExtractedContractTermsSchema = z.object({
  paymentClaimMethod: z.string().nullable(),
  paymentClaimDay: z.number().int().nullable(),
  variationNoticePeriodDays: z.number().int().nullable(),
  variationNoticeMethod: z.string().nullable(),
  delayNoticePeriodDays: z.number().int().nullable(),
  delayNoticeMethod: z.string().nullable(),
  retentionPercent: z.number().nullable(),
  defectsLiabilityPeriodDays: z.number().int().nullable(),
  disputeNoticeMethod: z.string().nullable(),
  generalNoticeMethod: z.string().nullable(),
  materialsMarkupPercent: z.number().nullable(),
  dayWorksRateNormal: z.number().nullable(),
  dayWorksRateNight: z.number().nullable(),
  dayWorksRateSundayHoliday: z.number().nullable(),
  dayWorksRateNotes: z.string().nullable(),
  variationScheduleType: z.enum(["fixed_date", "working_days_before_month_end"]).nullable(),
  variationScheduleValue: z.number().int().nullable()
});

export type ExtractedContractTerms = z.infer<typeof ExtractedContractTermsSchema>;

// Runs on the already-extracted Clause[] from Step 0 (no new PDF parsing) —
// pure fact extraction, not comparison, so one call is enough (matches
// extractProgrammeFromText's complexity level). Insurance requirements
// (types/minimum amounts) are deliberately not extracted here — they're
// already surfaced as part of the deviation report's indemnity_insurance
// bucket comparison, and there's no InsuranceRequirement model to store a
// separate structured extraction in (see subbie_hq_insurance_and_nav memory).
export async function extractContractTermsFromClauses(
  clauses: { clauseRef: string; title: string | null; body: string; pageNumber: number | null }[],
  usageContext: Omit<AiUsageContext, "feature">
): Promise<ExtractedContractTerms> {
  const documentText = clauses
    .map((c) => `[${c.clauseRef}]${c.title ? ` ${c.title}` : ""}${c.pageNumber ? ` (p.${c.pageNumber})` : ""}\n${c.body}`)
    .join("\n\n");

  const response = await callGrok({
    model: GROK_MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You extract actionable reference data from a construction subcontract agreement's clauses, for a subcontractor's project settings. " +
          "Respond with only a JSON object matching this exact shape: " +
          '{"paymentClaimMethod": string | null, "paymentClaimDay": number | null, "variationNoticePeriodDays": number | null, "variationNoticeMethod": string | null, "delayNoticePeriodDays": number | null, "delayNoticeMethod": string | null, "retentionPercent": number | null, "defectsLiabilityPeriodDays": number | null, "disputeNoticeMethod": string | null, "generalNoticeMethod": string | null, "materialsMarkupPercent": number | null, "dayWorksRateNormal": number | null, "dayWorksRateNight": number | null, "dayWorksRateSundayHoliday": number | null, "dayWorksRateNotes": string | null, "variationScheduleType": "fixed_date" | "working_days_before_month_end" | null, "variationScheduleValue": number | null}. ' +
          "paymentClaimMethod: how/where payment claims must be submitted (e.g. 'email to accounts@...', 'post to registered office'), or null if not stated. " +
          "paymentClaimDay: the day of the month payment claims are due, if a fixed day is stated, else null. " +
          "variationNoticePeriodDays: the number of days' notice required for a variation claim/instruction (usually a distinct clause from delay/EOT notices below), if stated, else null. " +
          "variationNoticeMethod: how variation notices must be given, if stated, else null. " +
          "delayNoticePeriodDays: the number of days' notice required to claim an Extension of Time / delay event (often a SEPARATE clause from the variation notice period above, sometimes with a different day count) — if stated, else null. " +
          "delayNoticeMethod: how delay/Extension of Time notices must be given, if stated, else null. " +
          "retentionPercent: the retention percentage withheld from payments, if stated, else null. " +
          "defectsLiabilityPeriodDays: the defects liability period in days, if stated (convert months/years to days), else null. " +
          "disputeNoticeMethod: how a notice of dispute must be given, if stated, else null. " +
          "generalNoticeMethod: the default/general method for serving notices under the contract (e.g. post, fax, hand delivery, email), if stated, else null. " +
          "materialsMarkupPercent: the markup/margin percentage the subcontractor may add to materials cost for day works/variations, if stated, else null. " +
          "dayWorksRateNormal/dayWorksRateNight/dayWorksRateSundayHoliday: the contract's day works labour rate ($/hr) for, respectively, normal hours (Monday-Saturday 7am-5pm), hours outside that window on Monday-Saturday, and Sunday/public holidays — populate whichever of these three the contract genuinely and separately states; leave a bucket null if the contract doesn't distinguish it (e.g. a single flat rate for all hours only fills dayWorksRateNormal). Never invent a number for a distinction the contract doesn't make. " +
          "dayWorksRateNotes: if the contract's day works rate structure doesn't map cleanly onto the three buckets above (e.g. it states one flat rate for all hours, or draws a different distinction such as a separate Saturday rate), briefly describe what's actually stated here as free text; null if the three buckets above already capture it fully or no day works rate is stated at all. " +
          "variationScheduleType/variationScheduleValue: when the contract states a clear, specific deadline for submitting a variation/SI claim each month, classify it as one of two shapes and populate the matching value. 'fixed_date': the contract names a fixed day of the month (e.g. 'claims must be submitted by the 20th of each month') — variationScheduleValue is that day-of-month number (1-31). 'working_days_before_month_end': the contract expresses it relative to month-end (e.g. 'not later than 3 working days before the end of each month') — variationScheduleValue is that number of working days. If the contract doesn't state a clear, specific number for either shape, leave both fields null rather than guessing — this drives an automated external send, so an invented number is worse than none."
      },
      { role: "user", content: documentText }
    ]
  }, { ...usageContext, feature: "contract_review" });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("No response from Grok.");
  }

  return ExtractedContractTermsSchema.parse(JSON.parse(raw));
}

const ExtractedQuoteLineItemSchema = z.object({
  description: z.string(),
  amount: z.number().nullable()
});

const ExtractedQuoteSchema = z.object({
  quotedValue: z.number().nullable(),
  quotedDate: z.string().nullable(),
  scopeSummary: z.string().nullable(),
  lineItems: z.array(ExtractedQuoteLineItemSchema),
  commercialNotes: z.string().nullable()
});

export type ExtractedQuote = z.infer<typeof ExtractedQuoteSchema>;

// A genuinely separate document/call from the contract terms extraction
// above — a quote is commercial (scope priced by the subcontractor), not
// the governing contract's clauses, so it gets its own feature tag rather
// than folding into "contract_review". Groundwork only for a future
// Payment Claims comparison (see lib/document-processing.ts's
// processQuoteDocument, which stores this result) — no comparison logic
// here.
export async function extractQuoteFromText(
  documentText: string,
  usageContext: Omit<AiUsageContext, "feature">
): Promise<ExtractedQuote> {
  const response = await callGrok(
    {
      model: GROK_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You extract structured commercial data from a subcontractor's priced quote for construction work. Respond with only a JSON object matching this exact shape: " +
            '{"quotedValue": number | null, "quotedDate": string | null, "scopeSummary": string | null, "lineItems": [{"description": string, "amount": number | null}], "commercialNotes": string | null}. ' +
            "quotedValue: the total quoted price/value, if stated (exclude GST unless no other total is given), else null. " +
            "quotedDate: the date the quote was issued, as an ISO 8601 date (YYYY-MM-DD), or null if not stated. " +
            "scopeSummary: a concise 1-3 sentence summary of the scope of work the quote covers. " +
            "lineItems: one entry per priced line/item on the quote (description and its amount); an empty array if the quote only states a single lump-sum total with no itemised breakdown. " +
            "commercialNotes: any other clearly-stated commercial terms (e.g. payment terms, validity period, exclusions, GST treatment), briefly summarized as free text, or null if none are stated."
        },
        { role: "user", content: documentText }
      ]
    },
    { ...usageContext, feature: "quote_extraction" }
  );

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("No response from Grok.");
  }

  return ExtractedQuoteSchema.parse(JSON.parse(raw));
}

// ============================================================
// Contract Schedule of Values extraction (Phase 2 of that feature — see
// lib/contract-schedule.ts for Phase 1's schema/calculation engine). A
// genuinely separate, much richer extraction from extractQuoteFromText
// above: that one is a flat summary (a total + optional plain description/
// amount lines) for the Contract tab's lightweight display; this reads a
// PRICED SCHEDULE with real column structure (Supply/Install/Erect &
// Dismantle/Transport/Weekly Hire/etc, sometimes a global Erect/Dismantle
// split note) and turns it into the component/phase shape Payment Claims
// actually calculates against.
//
// Vision, not text — confirmed directly against a real scaffold quote
// (Cintra Apartments) that plain pdftotext-style extraction reorders this
// exact kind of multi-column table badly enough to silently misassign
// dollar figures to the wrong column. Mirrors
// extractDayWorksSheetSummariesFromImages's proven shape: multiple images
// (every page — the priced table and any notes/schedule-of-rates page
// describing a global split are often on different pages), per-item
// confidence + notes, never guess.
// ============================================================

const ExtractedScheduleComponentPhaseSchema = z.object({
  label: z.string(),
  sharePercent: z.number()
});

// .nullish() (not just .nullable()) throughout this schema — confirmed
// necessary against a real response: Grok frequently OMITS a key it
// considers not applicable (e.g. no "weeklyRate" property at all on a
// fixed component) rather than explicitly setting it to JSON null, and a
// strictly-required field failing validation on every single not-
// applicable field is exactly what happened the first time this was
// tried against the real Cintra quote (every component rejected with
// "Required" on 3-4 fields at once) — not a genuine parsing failure.
const ExtractedScheduleComponentSchema = z.object({
  kind: z.enum(["fixed", "weekly_hire"]),
  label: z.string(),
  // fixed only:
  amount: z.number().nullish(),
  // fixed only, and ONLY when this specific line item's charge is genuinely
  // split into stages (e.g. Erect & Dismantle) — a plain single-stage
  // amount (Supply only, Transport, a lump-sum fee) should have this as
  // null, not a single 100%-share phase; the caller defaults an unsplit
  // fixed component to one implicit 100% phase.
  phases: z.array(ExtractedScheduleComponentPhaseSchema).nullish(),
  // weekly_hire only:
  weeklyRate: z.number().nullish(),
  quotedDurationWeeks: z.number().nullish()
});

const ExtractedScheduleItemSchema = z.object({
  sectionLabel: z.string().nullish(),
  description: z.string(),
  components: z.array(ExtractedScheduleComponentSchema),
  confidence: z.number(),
  notes: z.string().nullish()
});

const ExtractedContractScheduleSchema = z.object({
  items: z.array(ExtractedScheduleItemSchema),
  // A GLOBAL split stated once for the whole quote (e.g. "70% Erect / 30%
  // Dismantle"), often on a different page from the priced table itself —
  // applied by the caller as the default phase split offered for any
  // erect/dismantle-shaped fixed component that didn't get its own
  // explicit per-line split above. Null if the quote never states one.
  defaultErectPercent: z.number().nullish(),
  defaultDismantlePercent: z.number().nullish(),
  // The document's OWN printed grand total (excl. GST, matching how these
  // quotes are conventionally priced), if shown anywhere — used for a
  // deterministic self-verification cross-check in code afterward, never
  // trusted as the actual schedule total itself.
  printedGrandTotal: z.number().nullish()
});

export type ExtractedScheduleItem = z.infer<typeof ExtractedScheduleItemSchema>;
export type ExtractedContractSchedule = z.infer<typeof ExtractedContractScheduleSchema> & {
  // Added by resolveExtractedContractSchedule below, not the model itself.
  computedTotal: number;
  totalMismatchWarning: string | null;
};

export async function extractContractScheduleFromImages(
  images: { dataUrl: string }[],
  usageContext: Omit<AiUsageContext, "feature">
): Promise<ExtractedContractSchedule> {
  const response = await callGrok(
    {
      model: GROK_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You read a subcontractor's priced quote for construction work (one or more pages, possibly including a schedule-of-rates or terms page as well as the priced table itself) and extract a structured schedule of values. Look carefully at every row and every dollar figure — a quote's pricing table often has several dollar columns per line (e.g. a lump-sum charge, a transport/delivery charge, a weekly rental rate, a duration in weeks), and reading a column's value against the wrong row or column is a real, costly mistake — check alignment carefully, especially where the table is dense. Respond with only a JSON object matching this exact shape: " +
            '{"items": [{"sectionLabel": string | null, "description": string, "components": [{"kind": "fixed" | "weekly_hire", "label": string, "amount": number | null, "phases": [{"label": string, "sharePercent": number}] | null, "weeklyRate": number | null, "quotedDurationWeeks": number | null}], "confidence": number, "notes": string | null}], "defaultErectPercent": number | null, "defaultDismantlePercent": number | null, "printedGrandTotal": number | null}. ' +
            "items: one entry per priced line on the quote (a row like 'Stage A' or 'SAS 01 - Stair Access to Stair 1'), in the order they appear, preserving any section/elevation grouping heading above them (sectionLabel, e.g. 'NORTH ELEVATION') — null if the quote has no such grouping. " +
            "components: every distinct dollar column actually priced on this line becomes its own component — do not invent a component for a column that's blank/dashed/not priced on this particular row. A column charging for supply/install/erect/dismantle/remove work (however labelled — 'Erect & Dismantle', 'Supply & Install', 'Install', etc.) is kind \"fixed\", amount = that column's value. A separate transport/delivery/freight column is its OWN fixed component (do not merge it into the erect/install component), amount = that column's value. Any other named lump-sum column (e.g. an Engineer's Fee, a one-off inspection charge) is also its own fixed component. A weekly rental/hire column paired with a duration-in-weeks column is kind \"weekly_hire\": weeklyRate = the rental column's value, quotedDurationWeeks = the paired duration column's value (null if no duration column exists). Never create a component for the row's own TOTAL/total cost column — that is the sum of the other columns, not a component of its own, and is not needed in the output. " +
            "phases: ONLY set this (as an array) when a fixed component's charge is genuinely staged (most commonly Erect & Dismantle, or Supply/Install/Dismantle/Remove) AND you can find a stated split for it — either printed against this specific line, or a global split stated once elsewhere in the document (see defaultErectPercent below), in which case apply that global split here using its exact stage labels (e.g. 'Erect'/'Dismantle'). Leave this null for a plain single-stage charge (Supply only, Transport, a flat fee) — the caller treats null as one implicit 100% stage, so do not invent a single-entry phases array yourself. " +
            "defaultErectPercent/defaultDismantlePercent: read from a note stated ONCE for the whole quote (e.g. a 'Breakdown of Charges' box saying '70% Erect / 30% Dismantle') — null if no such global note exists anywhere in the document. " +
            "printedGrandTotal: the quote's own overall total figure, exactly as printed (excluding GST unless no other total is given) — null if the document never states one. " +
            "confidence: your own honest 0-1 confidence in THIS line's extraction — lower it for anything genuinely hard to read or ambiguous (a merged/split table cell, a figure that could belong to either of two adjacent columns); a component genuinely not priced on this line is normal and should NOT by itself lower confidence. " +
            "notes: a brief plain-English note on anything uncertain about this line, so a human reviewer knows exactly what to double-check — null if nothing is uncertain. " +
            "Never guess or invent a figure you can't reasonably support from what's visible — use null instead."
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Read the priced quote in the following image(s) and extract the structured schedule of values described." },
            ...images.map((image) => ({ type: "image_url" as const, image_url: { url: image.dataUrl } }))
          ]
        }
      ]
    },
    { ...usageContext, feature: "contract_schedule_extraction" }
  );

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("No response from Grok.");
  }

  const parsed = ExtractedContractScheduleSchema.parse(JSON.parse(raw));
  return resolveExtractedContractSchedule(parsed);
}

// Self-verification (deterministic, in code — never trust the model's own
// arithmetic): recomputes the schedule's total the exact same way
// lib/contract-schedule.ts's computeScheduleTotalValue does (fixed amounts
// summed directly, weekly_hire valued at rate x quoted duration) and
// compares it against the quote's own printed grand total, when one was
// found. A mismatch doesn't block the extraction — it's surfaced as one
// schedule-level warning for the reviewer, the same "flag it, don't hide
// it, don't block on it" principle as the Day Works crew-size cross-check.
const TOTAL_MISMATCH_TOLERANCE_FRACTION = 0.02; // 2% — printed totals are sometimes rounded
const TOTAL_MISMATCH_TOLERANCE_ABSOLUTE = 50; // and small quotes need an absolute floor, not just a %

function resolveExtractedContractSchedule(
  parsed: z.infer<typeof ExtractedContractScheduleSchema>
): ExtractedContractSchedule {
  let computedTotal = 0;
  for (const item of parsed.items) {
    for (const component of item.components) {
      if (component.kind === "weekly_hire") {
        computedTotal += (component.weeklyRate ?? 0) * (component.quotedDurationWeeks ?? 0);
      } else {
        computedTotal += component.amount ?? 0;
      }
    }
  }

  let totalMismatchWarning: string | null = null;
  if (parsed.printedGrandTotal != null) {
    const tolerance = Math.max(TOTAL_MISMATCH_TOLERANCE_ABSOLUTE, parsed.printedGrandTotal * TOTAL_MISMATCH_TOLERANCE_FRACTION);
    if (Math.abs(computedTotal - parsed.printedGrandTotal) > tolerance) {
      totalMismatchWarning = `The extracted line items add up to $${computedTotal.toFixed(2)}, but the quote's own printed total is $${parsed.printedGrandTotal.toFixed(2)} — please check the extracted items against the original quote before confirming.`;
    }
  }

  return { ...parsed, computedTotal, totalMismatchWarning };
}

const PriorContractDeviationSchema = BucketDeviationSchema.extend({ topicBucket: z.string() });
const PriorContractComparisonResultSchema = z.object({ deviations: z.array(PriorContractDeviationSchema) });

export type PriorContractDeviation = z.infer<typeof PriorContractDeviationSchema>;

// Map phase for a prior_contract-type review (see lib/contract-comparison.ts)
// — same map-reduce shape as compareClausesToStandardBucket, but there's no
// fixed topic-bucket structure to chunk by since the "baseline" here is an
// arbitrary previously-uploaded contract, not SA-2017. Instead this chunks
// the PRIOR contract's clauses (the reference/checklist side, playing the
// role baseline clauses played) and sends the FULL new-contract clause list
// each time (the side being searched, playing subcontract clauses' role) —
// the same "chunk one side, send the other whole" principle, just applied
// to whichever side is being used as the checklist. classification reuses
// DeviationClassification's baseline-oriented names: missing_from_subcontract
// = a clause the prior contract had that this one has dropped;
// additional_in_subcontract = a clause new to this contract with no prior
// counterpart.
const PRIOR_CONTRACT_CHUNK_SIZE = 20;
// Same reasoning as compareClausesToStandardBucket's caller in
// lib/contract-comparison.ts — firing every chunk at once can make most of
// them queue for minutes rather than genuinely run in parallel.
const PRIOR_CONTRACT_CONCURRENCY = 4;

export async function compareClausesToPriorContract(
  priorClauses: ClauseLike[],
  newClauses: ClauseLike[],
  usageContext: Omit<AiUsageContext, "feature">
): Promise<PriorContractDeviation[]> {
  const newContractText = formatClausesForPrompt(newClauses);

  const chunks: ClauseLike[][] = [];
  for (let i = 0; i < priorClauses.length; i += PRIOR_CONTRACT_CHUNK_SIZE) {
    chunks.push(priorClauses.slice(i, i + PRIOR_CONTRACT_CHUNK_SIZE));
  }

  const results: PriorContractDeviation[][] = new Array(chunks.length);
  let nextChunkIndex = 0;
  async function worker() {
    while (nextChunkIndex < chunks.length) {
      const index = nextChunkIndex++;
      results[index] = await compareOneChunk(chunks[index]);
    }
  }

  async function compareOneChunk(chunk: ClauseLike[]): Promise<PriorContractDeviation[]> {
      const priorContractText = formatClausesForPrompt(chunk);

      const response = await callGrok({
        model: GROK_MODEL,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are comparing a newly-uploaded subcontract agreement against this same Main Contractor's PREVIOUS contract with this subcontractor, to flag anything that has changed, been added, or been removed — the Main Contractor may have quietly updated their own template. " +
              "The two documents' clause numbers will NOT correspond — match clauses by what they actually say and require, not by label. " +
              "For every prior-contract clause below, carefully check whether the new contract contains a clause covering the same subject matter, and if so whether its substance matches, is a minor (wording/technical/administrative) deviation, or is a major deviation (changes obligations, liability, risk allocation, deadlines, amounts, or removes a protection). " +
              "Also separately check whether the new contract contains any clause on this section's topic that has NO counterpart at all in the prior-contract clauses below (a newly-added clause). " +
              "Respond with only a JSON object matching this exact shape: " +
              '{"deviations": [{"topicBucket": string, "baselineClauseRef": string | null, "baselineClauseTitle": string | null, "subcontractClauseRef": string | null, "subcontractExcerpt": string | null, "classification": "matches_standard" | "minor_deviation" | "major_deviation" | "missing_from_subcontract" | "additional_in_subcontract", "impact": "low" | "medium" | "high", "rationale": string, "recommendation": string | null}]}. ' +
              "topicBucket: a short topic label for this deviation (e.g. 'Payment Terms', 'Variations', 'Insurance'). " +
              "classification: matches_standard = substantively unchanged from the prior contract; minor_deviation = differs but low practical impact; major_deviation = differs in a way that meaningfully changes risk, liability, obligations, deadlines, or amounts vs the prior contract; missing_from_subcontract = a clause the prior contract had that this new one has dropped with no replacement; additional_in_subcontract = a new clause in this contract with no counterpart in the prior contract. " +
              "baselineClauseRef/baselineClauseTitle: the PRIOR contract's clause being compared (from the 'PRIOR CONTRACT CLAUSES' list below), or null for additional_in_subcontract. " +
              "subcontractClauseRef/subcontractExcerpt: the matching NEW contract clause reference and a short verbatim excerpt, or null for missing_from_subcontract. " +
              "impact: how much this specific change shifts risk/liability onto the subcontractor compared to the prior contract — low/medium/high. Always low for matches_standard. " +
              "rationale: 1-2 plain-English sentences explaining the change and why it matters (or briefly confirming it's unchanged). " +
              "recommendation: a short, practical suggestion, or null if none needed. " +
              "Include one entry per prior-contract clause below (even matches_standard ones — keep those brief), plus any additional_in_subcontract entries you find. Be thorough."
          },
          {
            role: "user",
            content: `PRIOR CONTRACT CLAUSES (this Main Contractor's previous contract with this subcontractor):\n${priorContractText}\n\n---\n\nNEW CONTRACT CLAUSES (full document, for matching against the above):\n${newContractText}`
          }
        ]
      }, { ...usageContext, feature: "contract_review" });

      const raw = response.choices[0]?.message?.content;
      if (!raw) {
        throw new Error("No response from Grok.");
      }

      return PriorContractComparisonResultSchema.parse(JSON.parse(raw)).deviations;
  }

  await Promise.all(Array.from({ length: Math.min(PRIOR_CONTRACT_CONCURRENCY, chunks.length) }, () => worker()));

  return results.flat();
}

const DraftedLetterSchema = z.object({ letterBody: z.string() });

export type DraftedLetter = z.infer<typeof DraftedLetterSchema>;

// Drafts one combined response letter covering every ticked deviation, for a
// subcontractor to send to a Main Contractor contact pushing back on flagged
// clauses. Each deviation carries its own comparedAgainstLabel — a letter
// can combine clauses from a prior_contract review ("differs from your
// previous contract with us") with clauses from the accompanying baseline
// drift callout ("differs from the SA-2017 standard form"), since both are
// selectable together. The mandatory not-legal-advice disclaimer is
// deliberately NOT left to the model to include — the caller
// (app/api/.../draft-letter/route.ts) appends it deterministically after
// this returns, so it can never be dropped or paraphrased away.
export async function draftResponseLetter(
  deviations: {
    baselineClauseRef: string | null;
    baselineClauseTitle: string | null;
    subcontractClauseRef: string | null;
    rationale: string;
    recommendation: string | null;
    comparedAgainstLabel: string;
  }[],
  letterContext: {
    mainContractorName: string;
    contactName: string;
    contactRole: string | null;
    projectName: string;
  },
  usageContext: Omit<AiUsageContext, "feature">
): Promise<DraftedLetter> {
  const deviationsText = deviations
    .map(
      (d, i) =>
        `${i + 1}. ${d.subcontractClauseRef ? `Clause ${d.subcontractClauseRef}` : "New clause"}` +
        `${d.baselineClauseRef ? ` (vs ${d.baselineClauseRef})` : ""} — compared against ${d.comparedAgainstLabel}: ${d.rationale}${d.recommendation ? ` Suggested change: ${d.recommendation}` : ""}`
    )
    .join("\n");

  const response = await callGrok({
    model: GROK_MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You draft a professional, genuinely usable response letter/email from a construction subcontractor to a Main Contractor, pushing back on specific contract clauses that were flagged as deviating from either the SA-2017 standard-form baseline or the subcontractor's previous contract with this same Main Contractor (each flagged clause below states which). " +
          "Respond with only a JSON object matching this exact shape: " +
          '{"letterBody": string}. ' +
          "letterBody: a complete, ready-to-send letter — a professional greeting addressed to the named contact, 1-2 sentences of context (referencing the project name and that this follows a review of the subcontract agreement), then one clearly-written paragraph per flagged clause explaining specifically how it differs from whichever baseline it was compared against and making a clear, professional, non-confrontational case for why it should be amended (referencing that baseline where useful), then a brief closing paragraph inviting discussion, then a sign-off. " +
          "Do not include a subject line, do not include placeholder brackets like [Your Name] — write it as ready to send as-is other than the sender's own signature. " +
          "Do not include any legal disclaimer — that is appended separately. " +
          "Professional tone throughout, not a bare bullet list — full sentences and paragraphs a Main Contractor would take seriously."
      },
      {
        role: "user",
        content:
          `Project: ${letterContext.projectName}\nMain Contractor: ${letterContext.mainContractorName}\nAddressed to: ${letterContext.contactName}${letterContext.contactRole ? ` (${letterContext.contactRole})` : ""}\n\nFlagged clauses:\n${deviationsText}`
      }
    ]
  }, { ...usageContext, feature: "contract_review_response_letter" });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("No response from Grok.");
  }

  return DraftedLetterSchema.parse(JSON.parse(raw));
}

const DraftedExternalActionMessageSchema = z.object({ messageBody: z.string() });

export type DraftedExternalActionMessage = z.infer<typeof DraftedExternalActionMessageSchema>;

// Drafts the message shown to the recipient of an External Action request
// (Approve/Sign/Confirm/Reject on a Variation/SI or Day Works Sheet) —
// this REPLACES showing the source record's own description as the
// primary ask (a real, confirmed bug: a Main Contractor being shown their
// own instruction text back and asked to "approve" it is meaningless).
// Same drafting pattern/conventions as draftResponseLetter above (a
// short, professional message via one Grok call, reviewed and editable by
// the sender before anything sends — see RequestActionDialog), just for a
// different message shape. recordedValue is null when nothing has been
// logged yet — the prompt is instructed never to invent a figure in that
// case, matching this app's "never assert what the records don't support"
// convention.
export async function draftExternalActionRequestMessage(
  params: {
    actionTypeLabel: string;
    itemReference: string;
    itemTitle: string;
    isSiteInstruction: boolean;
    recordedValue: number | null;
    valueContextLabel: string;
  },
  usageContext: Omit<AiUsageContext, "feature">
): Promise<DraftedExternalActionMessage> {
  const itemKind = params.isSiteInstruction ? "Site Instruction" : "Variation";
  const valueLine =
    params.recordedValue != null
      ? `Recorded value to date: $${params.recordedValue.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, from ${params.valueContextLabel}.`
      : `No cost has been recorded against this yet.`;

  const response = await callGrok({
    model: GROK_MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You draft a short, professional message from a construction subcontractor to a Main Contractor, requesting they " +
          `${params.actionTypeLabel.toLowerCase()} a specific ${itemKind}. ` +
          "Respond with only a JSON object matching this exact shape: " +
          '{"messageBody": string}. ' +
          "messageBody: 2-4 plain sentences, no greeting/sign-off (those are added separately by the app), stating clearly that this " +
          `${itemKind.toLowerCase()} is being carried out under Day Works and will incur additional cost, citing the recorded value ` +
          "figure given below EXACTLY as stated — never invent, round unusually, or embellish a figure beyond what's given, and if told " +
          "no cost has been recorded yet, say so plainly rather than implying any amount. End with a clear, professional request for " +
          `their ${params.actionTypeLabel.toLowerCase()}. Do not invent details about scope or cause beyond the reference/title given.`
      },
      {
        role: "user",
        content: `${itemKind}: ${params.itemReference} — ${params.itemTitle}\n${valueLine}`
      }
    ]
  }, { ...usageContext, feature: "external_action_draft" });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("No response from Grok.");
  }

  return DraftedExternalActionMessageSchema.parse(JSON.parse(raw));
}

// Drafts the message for a Request Approval sent on a specific generated
// VariationPackage — same pattern/conventions as draftExternalActionRequestMessage
// above (short, professional, one Grok call, honest about figures), but
// with the CUMULATIVE + NEW-SINCE-LAST framing a package approval needs:
// on a first-ever request there's nothing to compare against, so the
// message states the cumulative total plainly; on a follow-up request it
// states both the cumulative total AND the amount that's changed since
// the last approval request, using a figure computed deterministically by
// the caller (never left to the model to subtract).
export async function draftPackageApprovalMessage(
  params: {
    itemReference: string;
    itemTitle: string;
    isSiteInstruction: boolean;
    cumulativeTotal: number;
    newSinceLastTotal: number | null; // null = first-ever request for this item
  },
  usageContext: Omit<AiUsageContext, "feature">
): Promise<DraftedExternalActionMessage> {
  const itemKind = params.isSiteInstruction ? "Site Instruction" : "Variation";
  const formattedCumulative = params.cumulativeTotal.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const valueLine =
    params.newSinceLastTotal == null
      ? `This is the first Variation Package sent for approval on this item. Cumulative recorded value to date: $${formattedCumulative}.`
      : `Cumulative recorded value to date: $${formattedCumulative}. Since the last approval request, an additional $${params.newSinceLastTotal.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} has been recorded.`;

  const response = await callGrok({
    model: GROK_MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You draft a short, professional message from a construction subcontractor to a Main Contractor, sending a Variation Package " +
          `(a bundled PDF of evidence) for their approval on a specific ${itemKind}. ` +
          "Respond with only a JSON object matching this exact shape: " +
          '{"messageBody": string}. ' +
          "messageBody: 2-4 plain sentences, no greeting/sign-off (added separately by the app). State clearly that the attached " +
          "Variation Package is being submitted for approval. Cite the cumulative value figure given below EXACTLY as stated — never " +
          "invent, round unusually, or embellish it. If this is a FIRST request, present the cumulative figure as the whole ask. If " +
          "this is a FOLLOW-UP request (a 'since the last approval request' figure is given), clearly distinguish the cumulative " +
          "total from the additional new amount since the last request — a reader should understand both what the running total is " +
          "and what's new this time, without needing to do their own subtraction. End with a clear, professional request for their " +
          "approval. Do not invent scope details beyond the reference/title given."
      },
      {
        role: "user",
        content: `${itemKind}: ${params.itemReference} — ${params.itemTitle}\n${valueLine}`
      }
    ]
  }, { ...usageContext, feature: "external_action_draft" });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("No response from Grok.");
  }

  return DraftedExternalActionMessageSchema.parse(JSON.parse(raw));
}

// Drafts a formal Delay/EOT notice (SA-2017 clause 10) — same pattern/
// conventions as draftExternalActionRequestMessage above (short,
// professional, one Grok call, honest about figures, never invents scope/
// cause details beyond what's given). The one real difference: this asks
// for a specific number of EOT DAYS to be approved, not a cost figure, and
// states the clause reference when one's on file so the notice itself
// reads as a real contractual notice, not a generic request.
export async function draftDelayNoticeMessage(
  params: {
    cause: string;
    startDate: string; // formatted for display, e.g. "12 Aug 2026"
    endDate: string | null;
    clauseReference: string | null;
    daysClaimed: number | null;
  },
  usageContext: Omit<AiUsageContext, "feature">
): Promise<DraftedExternalActionMessage> {
  const dateLine = params.endDate ? `${params.startDate} to ${params.endDate}` : `from ${params.startDate}, ongoing`;
  const daysLine = params.daysClaimed != null ? `Claiming ${params.daysClaimed} day(s) Extension of Time.` : "No specific day count assessed yet.";
  const clauseLine = params.clauseReference ? `Notice given under ${params.clauseReference}.` : "";

  const response = await callGrok({
    model: GROK_MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You draft a short, formal Extension of Time (delay) notice from a construction subcontractor to a Main Contractor/" +
          "Contract Administrator, under a NZ standard-form subcontract. Respond with only a JSON object matching this exact shape: " +
          '{"messageBody": string}. ' +
          "messageBody: 2-4 plain sentences, no greeting/sign-off (those are added separately by the app). State plainly that " +
          "this is formal written notice of a delay event, citing the cause and date range EXACTLY as given — never invent, " +
          "embellish, or guess at a cause/date/clause/day-count beyond what's given below. If a day count is stated, request " +
          "that number of days' Extension of Time; if not, state that an assessment will follow. End with a clear request for " +
          "the recipient to review and confirm the Extension of Time granted."
      },
      {
        role: "user",
        content: `Cause: ${params.cause}\nDelay period: ${dateLine}\n${daysLine}\n${clauseLine}`.trim()
      }
    ]
  }, { ...usageContext, feature: "external_action_draft" });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("No response from Grok.");
  }

  return DraftedExternalActionMessageSchema.parse(JSON.parse(raw));
}

const ExtractedCertificateCoverSchema = z.object({
  coverType: z.string(),
  value: z.number()
});
const ExtractedInsuranceCertificateSchema = z.object({
  provider: z.string().nullable(),
  policyNumber: z.string().nullable(),
  expiryDate: z.string().nullable(),
  covers: z.array(ExtractedCertificateCoverSchema)
});

export type ExtractedInsuranceCertificate = z.infer<typeof ExtractedInsuranceCertificateSchema>;

// Extracts insurer/policy/expiry plus every distinct cover type + value
// found on an insurance certificate PDF's text — used to pre-fill the
// certificate form for the user to review/correct, never saved directly
// (see app/api/organisation/insurance-certificates/parse/route.ts). Never
// guesses: fields with nothing confidently stated come back null/empty
// rather than a fabricated value.
export async function extractInsuranceCertificateFromText(
  documentText: string,
  usageContext: Omit<AiUsageContext, "feature">
): Promise<ExtractedInsuranceCertificate> {
  const response = await callGrok({
    model: GROK_MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You extract structured data from an insurance certificate of currency document. " +
          "Respond with only a JSON object matching this exact shape: " +
          '{"provider": string | null, "policyNumber": string | null, "expiryDate": string | null, "covers": [{"coverType": string, "value": number}]}. ' +
          "provider: the insurer/underwriter's name (not the broker, if both are shown), or null if not stated. " +
          "policyNumber: the policy number exactly as printed, or null if not stated. " +
          "expiryDate: the policy's expiry/renewal date as an ISO 8601 date (YYYY-MM-DD), or null if not stated. " +
          "covers: one entry per distinct type of cover shown with a monetary limit (e.g. Public Liability, Professional Indemnity, Contract Works, Employers Liability, Statutory Liability, Product Liability). " +
          'coverType: a short label for the cover type — prefer these exact labels when the document\'s wording clearly matches one: "Public Liability", "Professional Indemnity", "Contract Works", "Employers Liability" — otherwise use a short label close to the document\'s own wording. ' +
          "value: the limit of indemnity / sum insured for that cover type, as a plain number (no currency symbols or commas) — use the 'each and every claim' or per-occurrence limit if multiple limits are shown for the same cover, not the aggregate. " +
          "Only include a cover entry when both a clear type AND a clear numeric value are stated — do not include a type with no value, and do not invent a value. If nothing on the document confidently identifies a field, use null (or an empty covers array) rather than guessing."
      },
      { role: "user", content: documentText }
    ]
  }, { ...usageContext, feature: "insurance_extraction" });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("No response from Grok.");
  }

  return ExtractedInsuranceCertificateSchema.parse(JSON.parse(raw));
}

const ExtractedRequiredCoverSchema = z.object({
  coverType: z.string(),
  requiredValue: z.number()
});
const ExtractedRequiredCoverListSchema = z.object({ covers: z.array(ExtractedRequiredCoverSchema) });

export type ExtractedRequiredCover = z.infer<typeof ExtractedRequiredCoverSchema>;

// Runs on the already-extracted Clause[] from Contract Review's Step 0 (no
// new PDF parsing), alongside extractContractTermsFromClauses — scans for
// stated MINIMUM insurance cover requirements per type (e.g. "the
// Subcontractor shall hold Public Liability insurance of not less than
// $20,000,000"). Partial results are expected and fine (most contracts
// don't state every cover type) — only returns types with a clearly stated
// numeric minimum, never a fabricated/guessed one.
export async function extractRequiredInsuranceCoverFromClauses(
  clauses: { clauseRef: string; title: string | null; body: string }[],
  usageContext: Omit<AiUsageContext, "feature">
): Promise<ExtractedRequiredCover[]> {
  const documentText = clauses.map((c) => `[${c.clauseRef}]${c.title ? ` ${c.title}` : ""}\n${c.body}`).join("\n\n");

  const response = await callGrok({
    model: GROK_MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You extract stated MINIMUM insurance cover requirements from a construction subcontract agreement's clauses — the levels of insurance the subcontract requires the subcontractor to hold or maintain. " +
          "Respond with only a JSON object matching this exact shape: " +
          '{"covers": [{"coverType": string, "requiredValue": number}]}. ' +
          'coverType: prefer these exact labels when the clause\'s wording clearly matches one: "Public Liability", "Professional Indemnity", "Contract Works", "Employers Liability" — otherwise a short label close to the clause\'s own wording. ' +
          "requiredValue: the stated minimum cover amount as a plain number (no currency symbols or commas). " +
          "Only include an entry when the clauses state a clear minimum/required numeric amount for that specific cover type — most contracts only mention some cover types, or none at all with a specific number, and that's expected; return an empty array rather than inventing a requirement that isn't clearly stated."
      },
      { role: "user", content: documentText }
    ]
  }, { ...usageContext, feature: "contract_review" });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("No response from Grok.");
  }

  return ExtractedRequiredCoverListSchema.parse(JSON.parse(raw)).covers;
}

const DraftedUpdateEmailSchema = z.object({ subject: z.string(), body: z.string() });

export type DraftedUpdateEmail = z.infer<typeof DraftedUpdateEmailSchema>;

// Converts a subcontractor's rough progress-update text (typed or
// voice-transcribed — see lib/transcription.ts) into a professional
// email a Main Contractor or client would expect, for the user to review
// and edit before sending (see app/api/projects/[projectId]/updates/route.ts
// — nothing is sent without that human review step). Not a comparison or
// extraction task, so this is a single call like extractContractTermsFromClauses.
export async function draftExternalUpdateEmail(
  params: {
    roughText: string;
    projectName: string;
    authorName: string;
    // Total count across all attachment types (image/PDF/DOCX) — never
    // assume "photo" in the drafted wording, since an attachment might be
    // a PDF or DOCX (see lib/update-attachments.ts).
    attachmentCount: number;
  },
  usageContext: Omit<AiUsageContext, "feature">
): Promise<DraftedUpdateEmail> {
  const response = await callGrok({
    model: GROK_MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You convert a subcontractor's rough, informal progress-update notes into a professional progress-update email suitable for sending to a Main Contractor or client. " +
          "Respond with only a JSON object matching this exact shape: " +
          '{"subject": string, "body": string}. ' +
          "subject: a short, clear subject line referencing the project and that this is a progress update. " +
          "body: a complete, ready-to-send email — an appropriate greeting, a clearly-written summary of the work/progress described in the rough notes (do not invent details not present in the notes), " +
          (params.attachmentCount > 0
            ? `a brief mention that ${params.attachmentCount} attachment${params.attachmentCount === 1 ? " is" : "s are"} included, `
            : "") +
          "a professional sign-off. " +
          "Do not include placeholder brackets like [Your Name] — sign off with the author's name given below. " +
          "Professional tone throughout — this is going to a Main Contractor or client, not an internal team chat. Do not fabricate figures, dates, or claims the rough notes don't support."
      },
      {
        role: "user",
        content: `Project: ${params.projectName}\nAuthor: ${params.authorName}\n\nRough update notes:\n${params.roughText}`
      }
    ]
  }, { ...usageContext, feature: "external_update_draft" });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("No response from Grok.");
  }

  return DraftedUpdateEmailSchema.parse(JSON.parse(raw));
}

// Same drafted shape as draftExternalUpdateEmail, but for summarising an
// entire existing Update thread (the original update plus every reply, in
// order) into one outbound email — used when generating a follow-up email
// from a thread after the fact, rather than while composing a brand-new
// update. See app/api/projects/[projectId]/updates/[updateId]/draft-summary-email
// — same "draft, then human reviews before sending" rule applies.
export async function draftUpdateThreadSummaryEmail(
  params: {
    projectName: string;
    authorName: string;
    entries: { authorName: string; createdAt: Date; body: string }[];
    attachmentCount: number;
  },
  usageContext: Omit<AiUsageContext, "feature">
): Promise<DraftedUpdateEmail> {
  const threadText = params.entries
    .map((entry) => `[${entry.createdAt.toISOString().slice(0, 10)}] ${entry.authorName}: ${entry.body}`)
    .join("\n\n");

  const response = await callGrok({
    model: GROK_MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You summarise an internal discussion thread — a subcontractor's progress-update thread with several back-and-forth entries — into a single professional progress-update email suitable for sending to a Main Contractor or client. " +
          "Respond with only a JSON object matching this exact shape: " +
          '{"subject": string, "body": string}. ' +
          "subject: a short, clear subject line referencing the project and that this is a progress update. " +
          "body: a complete, ready-to-send email that summarises the WHOLE thread — cover every distinct point raised across all entries below, not just the most recent one, written as one coherent narrative rather than a list of separate messages. Do not invent details not present in the thread. " +
          (params.attachmentCount > 0
            ? `a brief mention that ${params.attachmentCount} attachment${params.attachmentCount === 1 ? " is" : "s are"} included, `
            : "") +
          "a professional sign-off. " +
          "Do not include placeholder brackets like [Your Name] — sign off with the author's name given below (the person sending this summary, not necessarily every author quoted in the thread). " +
          "Professional tone throughout — this is going to a Main Contractor or client, not an internal team chat. Do not fabricate figures, dates, or claims the thread doesn't support."
      },
      {
        role: "user",
        content: `Project: ${params.projectName}\nAuthor (sending this email): ${params.authorName}\n\nDiscussion thread, chronological:\n${threadText}`
      }
    ]
  }, { ...usageContext, feature: "update_thread_summary" });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("No response from Grok.");
  }

  return DraftedUpdateEmailSchema.parse(JSON.parse(raw));
}

// .nullish() (not .nullable()) — same failure mode already found and fixed
// once in the contract-review synthesis schema: this model reliably writes
// explicit null for a field it considered, but sometimes omits a key
// entirely for one it saw no reason to include at all (e.g. no
// projectConfidence when projectId is null). .nullable() rejects a missing
// key with a ZodError and silently kills the whole classification (caught
// by classifyAndSuggest's try/catch, see lib/inbound-email.ts) — leaving
// the email fully blank with zero indication anything went wrong, which is
// exactly what was reported. .nullish() accepts both forms.
const InboundEmailClassificationSchema = z.object({
  projectId: z.string().nullish(),
  projectConfidence: z.number().min(0).max(1).nullish(),
  suggestedType: z.string().nullish(),
  variationItemId: z.string().nullish(),
  summary: z.string()
});

export type InboundEmailClassification = z.infer<typeof InboundEmailClassificationSchema>;

// Triages one inbound email against the organisation's own projects — a
// single non-map-reduce call (org-wide project/contact lists are small
// enough to send in full, matching extractContractTermsFromClauses's
// complexity level, not the map-reduce contract-review pipeline). Never
// invents a project/Variation id outside the candidate lists given; returns
// null rather than guessing when unconfident (see Incoming Emails Task 2).
export async function classifyInboundEmail(
  params: {
    sender: string;
    ccAddresses: string[];
    subject: string;
    body: string;
    attachments: { fileName: string; extractedText: string | null }[];
    candidateProjects: {
      id: string;
      name: string;
      mainContractorName: string | null;
      contactEmails: string[];
      openVariationItems: { id: string; reference: string; title: string }[];
    }[];
  },
  usageContext: Omit<AiUsageContext, "feature">
): Promise<InboundEmailClassification> {
  const projectsText = params.candidateProjects
    .map((p) => {
      const contacts = p.contactEmails.length ? p.contactEmails.join(", ") : "none on file";
      const items = p.openVariationItems.length
        ? p.openVariationItems.map((i) => `${i.id}: ${i.reference} - ${i.title}`).join("; ")
        : "none";
      return (
        `Project id=${p.id} "${p.name}"${p.mainContractorName ? ` (Main Contractor: ${p.mainContractorName})` : ""}\n` +
        `  Known contact emails: ${contacts}\n` +
        `  Open Variations/Site Instructions: ${items}`
      );
    })
    .join("\n\n");

  // Attachment TEXT, not just filenames — a scanned/exported document titled
  // "scan0042.pdf" gives the model nothing to go on from its name alone, but
  // an attached Site Instruction's actual content is often the single
  // strongest signal for both project and type classification.
  const attachmentsText = params.attachments.length
    ? params.attachments
        .map((a) =>
          a.extractedText
            ? `--- Attachment "${a.fileName}" (extracted text) ---\n${a.extractedText}`
            : `--- Attachment "${a.fileName}" (content not extractable — judge from filename/email context only) ---`
        )
        .join("\n\n")
    : "(no attachments)";

  const response = await callGrok({
    model: GROK_MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You triage an inbound email for a subcontractor's project-management app, so a human reviewer can quickly file it correctly. " +
          "Respond with only a JSON object matching this exact shape: " +
          '{"projectId": string | null, "projectConfidence": number | null, "suggestedType": string | null, "variationItemId": string | null, "summary": string}. ' +
          "projectId: the id of whichever project below this email most likely belongs to, using every signal available — the sender's address, any CC'd addresses (a match against a project's known Main Contractor contact emails is a strong signal), subject, body content, quoted thread history, and attachment content. " +
          "People refer to projects informally and inconsistently — a project named \"St Lukes - Block 10\" in the system might be written in an email as \"10 St Luke's\", \"St Luke's site 10\", \"the St Lukes Block 10 job\", or similar. Reason about likely matches the way an experienced person on the team would (word order, minor spelling/punctuation differences, and reordered numbers/street names are all still the same project) — don't require a literal or exact string match. " +
          "ONLY return an id that appears in the candidate list below — never invent one. Only return null if genuinely no project in the list is a plausible match, not merely because the wording differs from the system name. " +
          "projectConfidence: your confidence in the projectId match, 0 to 1 (null if projectId is null). " +
          `suggestedType: what this email relates to — common categories include ${INBOUND_EMAIL_TYPE_PRESETS.join(", ")}, but use your own short free-text label if none of these fit well. An attached document's own title/content (e.g. a document headed "Site Instruction") is a strong signal — weigh it accordingly. Return null if you genuinely can't tell. ` +
          "variationItemId: if the email or an attachment clearly references a specific Variation or Site Instruction from the matched project's list below (by reference number or unambiguous context), return its id — only from that project's list, never invented, and only if projectId was also determined. Return null if uncertain or if no project was matched. " +
          "summary: a 1-2 sentence plain-English summary of what this email (and any attachments) is about, for a reviewer to quickly judge relevance without reading the full email."
      },
      {
        role: "user",
        content:
          `From: ${params.sender}\nCC: ${params.ccAddresses.join(", ") || "(none)"}\nSubject: ${params.subject}\n\n` +
          `Body:\n${params.body}\n\n---\n\n${attachmentsText}\n\n---\n\nCANDIDATE PROJECTS:\n${projectsText}`
      }
    ]
  }, { ...usageContext, feature: "incoming_email_classification" });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("No response from Grok.");
  }

  return InboundEmailClassificationSchema.parse(JSON.parse(raw));
}
