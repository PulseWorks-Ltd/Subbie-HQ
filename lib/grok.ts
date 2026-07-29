import OpenAI from "openai";
import { z } from "zod";

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
// comparisonLabel describes what the subcontract was compared against —
// "the SA-2017 standard-form baseline" for baseline reviews, or "their
// previous contract with this Main Contractor" for prior_contract reviews
// (see lib/contract-comparison.ts) — the prompt/wording adapts either way.
export async function synthesizeContractReview(
  bucketResults: { topicBucket: string; deviations: BucketDeviation[] }[],
  comparisonLabel = "the SA-2017 standard-form baseline"
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
          `You are prioritizing and summarizing a list of already-classified deviations found between a subcontract agreement and ${comparisonLabel}, for a subcontractor to review quickly without missing anything important. ` +
          "Respond with only a JSON object matching this exact shape: " +
          '{"executiveSummary": string, "overallRiskLevel": "low" | "medium" | "high", "deviations": [{"topicBucket": string, "baselineClauseRef": string | null, "baselineClauseTitle": string | null, "subcontractClauseRef": string | null, "subcontractExcerpt": string | null, "classification": string, "impact": "low" | "medium" | "high", "priorityScore": number, "rationale": string, "recommendation": string | null}]}. ' +
          `executiveSummary: 2-4 sentences, plain English, giving the overall picture (how many major issues, the general character of the changes, whether this looks like a lightly-modified or heavily-modified version of ${comparisonLabel}). ` +
          `overallRiskLevel: your overall assessment of how much this subcontract shifts risk onto the subcontractor compared to ${comparisonLabel}. ` +
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
  newClauses: ClauseLike[]
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

      const response = await getClient().chat.completions.create({
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
      });

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
  context: {
    mainContractorName: string;
    contactName: string;
    contactRole: string | null;
    projectName: string;
  }
): Promise<DraftedLetter> {
  const deviationsText = deviations
    .map(
      (d, i) =>
        `${i + 1}. ${d.subcontractClauseRef ? `Clause ${d.subcontractClauseRef}` : "New clause"}` +
        `${d.baselineClauseRef ? ` (vs ${d.baselineClauseRef})` : ""} — compared against ${d.comparedAgainstLabel}: ${d.rationale}${d.recommendation ? ` Suggested change: ${d.recommendation}` : ""}`
    )
    .join("\n");

  const response = await getClient().chat.completions.create({
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
          `Project: ${context.projectName}\nMain Contractor: ${context.mainContractorName}\nAddressed to: ${context.contactName}${context.contactRole ? ` (${context.contactRole})` : ""}\n\nFlagged clauses:\n${deviationsText}`
      }
    ]
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("No response from Grok.");
  }

  return DraftedLetterSchema.parse(JSON.parse(raw));
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
export async function extractInsuranceCertificateFromText(documentText: string): Promise<ExtractedInsuranceCertificate> {
  const response = await getClient().chat.completions.create({
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
  });

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
  clauses: { clauseRef: string; title: string | null; body: string }[]
): Promise<ExtractedRequiredCover[]> {
  const documentText = clauses.map((c) => `[${c.clauseRef}]${c.title ? ` ${c.title}` : ""}\n${c.body}`).join("\n\n");

  const response = await getClient().chat.completions.create({
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
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("No response from Grok.");
  }

  return ExtractedRequiredCoverListSchema.parse(JSON.parse(raw)).covers;
}
