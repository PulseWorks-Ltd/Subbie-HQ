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
  itemType: "variation" | "site_instruction"
): Promise<ExtractedVariationItem> {
  const documentKind =
    itemType === "variation"
      ? "a construction Variation notice or priced Variation quote"
      : "a construction Site Instruction / Notice to Subcontractor / Advice to Subcontractor document";

  const response = await getClient().chat.completions.create({
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
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("No response from Grok.");
  }

  return ExtractedVariationItemSchema.parse(JSON.parse(raw));
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
      `Only extract activities belonging to the trade referenced as "${tradeReference}" — use judgement, not literal text matching. ` +
      `"${tradeReference}" could appear in the document in any of these forms, and you should recognise all of them as the same trade: ` +
      `(a) a short code or abbreviation against each activity, e.g. in a 'Trade', 'Responsible', or 'Contractor' column, or resolved via a legend/key mapping codes to company names; ` +
      `(b) a word with a different form, tense, or spelling than what was typed — e.g. if given "Scaffold", also match "Scaffolding", "Scaffolded", "Scaffold Erection", "Scaffold Hire" and similar variants; ` +
      `(c) a section or sub-heading in the document (e.g. a bold row reading "SCAFFOLDING") under which several unlabelled activity rows are grouped until the next heading — in that case every activity under the matching heading belongs to this trade, even though the individual rows don't repeat the trade name; ` +
      `(d) a synonym or closely related trade term a person in the industry would recognise as the same trade, even if the exact word differs. ` +
      `Set "filterApplied" to true if you found and used any of these signals to identify "${tradeReference}"'s activities. ` +
      `If the document gives no usable signal to attribute activities to a trade at all (e.g. it is already a single-trade programme with no headings or codes), extract every activity instead and set "filterApplied" to false.`
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
export async function extractContractClausesFromText(documentText: string): Promise<ExtractedContractClause[]> {
  const response = await getClient().chat.completions.create({
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
  });

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
  baselineClauseRef: z.string().nullable(),
  baselineClauseTitle: z.string().nullable(),
  subcontractClauseRef: z.string().nullable(),
  subcontractExcerpt: z.string().nullable(),
  classification: DeviationClassificationSchema,
  impact: z.enum(["low", "medium", "high"]),
  rationale: z.string(),
  recommendation: z.string().nullable()
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
  subcontractClauses: ClauseLike[]
): Promise<BucketDeviation[]> {
  const baselineText = formatClausesForPrompt(baselineClauses);
  const subcontractText = formatClausesForPrompt(subcontractClauses);

  const response = await getClient().chat.completions.create({
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
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("No response from Grok.");
  }

  return BucketComparisonResultSchema.parse(JSON.parse(raw)).deviations;
}

const SynthesisDeviationSchema = BucketDeviationSchema.extend({
  topicBucket: z.string(),
  priorityScore: z.number().int().min(0).max(100)
});
const SynthesisResultSchema = z.object({
  executiveSummary: z.string(),
  overallRiskLevel: z.enum(["low", "medium", "high"]),
  deviations: z.array(SynthesisDeviationSchema)
});

export type SynthesisDeviation = z.infer<typeof SynthesisDeviationSchema>;
export type SynthesisResult = z.infer<typeof SynthesisResultSchema>;

// Step 2 (reduce phase) — one call. Takes every non-matching deviation
// already found and classified by the map phase (small, structured records,
// not raw legal text) and produces the prioritized, summarized report the
// founder asked for: an executive summary, an overall risk level, and a
// priorityScore per deviation so major/risk-shifting items surface first.
export async function synthesizeContractReview(
  bucketResults: { topicBucket: string; deviations: BucketDeviation[] }[]
): Promise<SynthesisResult> {
  const relevant = bucketResults.flatMap(({ topicBucket, deviations }) =>
    deviations
      .filter((deviation) => deviation.classification !== "matches_standard")
      .map((deviation) => ({ ...deviation, topicBucket }))
  );
  const matchCounts = bucketResults.map(({ topicBucket, deviations }) => ({
    topicBucket,
    matchCount: deviations.filter((deviation) => deviation.classification === "matches_standard").length
  }));

  const response = await getClient().chat.completions.create({
    model: GROK_MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are prioritizing and summarizing a list of already-classified deviations found between a subcontract agreement and the SA-2017 standard-form baseline, for a subcontractor to review quickly without missing anything important. " +
          "Respond with only a JSON object matching this exact shape: " +
          '{"executiveSummary": string, "overallRiskLevel": "low" | "medium" | "high", "deviations": [{"topicBucket": string, "baselineClauseRef": string | null, "baselineClauseTitle": string | null, "subcontractClauseRef": string | null, "subcontractExcerpt": string | null, "classification": string, "impact": "low" | "medium" | "high", "priorityScore": number, "rationale": string, "recommendation": string | null}]}. ' +
          "executiveSummary: 2-4 sentences, plain English, giving the overall picture (how many major issues, the general character of the changes, whether this looks like a lightly-modified or heavily-modified standard form). " +
          "overallRiskLevel: your overall assessment of how much this subcontract shifts risk onto the subcontractor compared to the standard form. " +
          "For each input deviation, include it in the output with the same fields plus a priorityScore (0-100, higher = more important for the subcontractor to read first) — major_deviation, missing_from_subcontract, and additional_in_subcontract entries should generally score higher than minor_deviation entries, but weigh actual practical impact (e.g. a 'minor'-labelled clause about a large retention change should still score highly). " +
          "Do not invent new deviations or drop any of the input deviations — reorder and score them, do not filter them out."
      },
      {
        role: "user",
        content: JSON.stringify({ deviations: relevant, matchCounts })
      }
    ]
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("No response from Grok.");
  }

  return SynthesisResultSchema.parse(JSON.parse(raw));
}

const ExtractedContractTermsSchema = z.object({
  paymentClaimMethod: z.string().nullable(),
  paymentClaimDay: z.number().int().nullable(),
  variationNoticePeriodDays: z.number().int().nullable(),
  variationNoticeMethod: z.string().nullable(),
  retentionPercent: z.number().nullable(),
  defectsLiabilityPeriodDays: z.number().int().nullable(),
  disputeNoticeMethod: z.string().nullable(),
  generalNoticeMethod: z.string().nullable()
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
  clauses: { clauseRef: string; title: string | null; body: string; pageNumber: number | null }[]
): Promise<ExtractedContractTerms> {
  const documentText = clauses
    .map((c) => `[${c.clauseRef}]${c.title ? ` ${c.title}` : ""}${c.pageNumber ? ` (p.${c.pageNumber})` : ""}\n${c.body}`)
    .join("\n\n");

  const response = await getClient().chat.completions.create({
    model: GROK_MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You extract actionable reference data from a construction subcontract agreement's clauses, for a subcontractor's project settings. " +
          "Respond with only a JSON object matching this exact shape: " +
          '{"paymentClaimMethod": string | null, "paymentClaimDay": number | null, "variationNoticePeriodDays": number | null, "variationNoticeMethod": string | null, "retentionPercent": number | null, "defectsLiabilityPeriodDays": number | null, "disputeNoticeMethod": string | null, "generalNoticeMethod": string | null}. ' +
          "paymentClaimMethod: how/where payment claims must be submitted (e.g. 'email to accounts@...', 'post to registered office'), or null if not stated. " +
          "paymentClaimDay: the day of the month payment claims are due, if a fixed day is stated, else null. " +
          "variationNoticePeriodDays: the number of days' notice required for a variation claim/instruction, if stated, else null. " +
          "variationNoticeMethod: how variation notices must be given, if stated, else null. " +
          "retentionPercent: the retention percentage withheld from payments, if stated, else null. " +
          "defectsLiabilityPeriodDays: the defects liability period in days, if stated (convert months/years to days), else null. " +
          "disputeNoticeMethod: how a notice of dispute must be given, if stated, else null. " +
          "generalNoticeMethod: the default/general method for serving notices under the contract (e.g. post, fax, hand delivery, email), if stated, else null."
      },
      { role: "user", content: documentText }
    ]
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("No response from Grok.");
  }

  return ExtractedContractTermsSchema.parse(JSON.parse(raw));
}
