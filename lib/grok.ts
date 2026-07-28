import OpenAI from "openai";
import { z } from "zod";

// Constructed lazily (not at module scope) — the OpenAI SDK validates apiKey
// presence eagerly in its constructor, which would crash Next.js's build-time
// page-data collection if this ran at import time with no key configured yet.
function getClient() {
  return new OpenAI({
    apiKey: process.env.XAI_API_KEY,
    baseURL: "https://api.x.ai/v1"
  });
}

// NOTE: xAI updates model names periodically — verify this is still current
// (https://docs.x.ai/docs/models) and adjust if the API starts returning a 404.
const GROK_MODEL = "grok-4-latest";

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
  tradeReference?: string
): Promise<ExtractedProgrammeResult> {
  const filterInstruction = tradeReference
    ? "This programme may cover multiple trades/subcontractors, not just one. " +
      `Only extract activities that belong to the trade/subcontractor referenced as "${tradeReference}" in this document — ` +
      "look for that code, abbreviation, or name against each activity (e.g. in a 'Trade', 'Responsible', or 'Contractor' column, in the activity's own text, or in a legend/key mapping codes to companies). " +
      `Set "filterApplied" to true if you were able to identify and filter to "${tradeReference}"'s activities. ` +
      `If the document does not tag activities by trade at all (e.g. it is already a single-trade programme), extract every activity instead and set "filterApplied" to false.`
    : "Extract every distinct activity/milestone in the document, regardless of trade, and set \"filterApplied\" to false.";

  const response = await getClient().chat.completions.create({
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
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("No response from Grok.");
  }

  return ExtractedProgrammeSchema.parse(JSON.parse(raw));
}
