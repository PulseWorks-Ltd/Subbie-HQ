// One-off script: parses the SA-2017 standard-form subcontract PDF into a
// structured, reviewable clause dataset committed at lib/standard-forms/sa-2017.json.
// Not wired into any npm lifecycle script — run manually:
//   node scripts/generate-standard-form-baseline.mjs
//
// The raw PDF (docs/Standard Documents/SA-2017-Entire.pdf) is licensed,
// copyrighted reference material and stays out of git — see docs/staging.md's
// sibling note in the plan and .gitignore. This script reads it locally once
// and produces the structured JSON that the app actually uses at runtime.

import { PDFParse } from "pdf-parse";
import OpenAI from "openai";
import { z } from "zod";
import { readFile, writeFile } from "node:fs/promises";
import { config } from "dotenv";

config();

const GROK_MODEL = "grok-4-latest";
function getClient() {
  return new OpenAI({ apiKey: process.env.XAI_API_KEY, baseURL: "https://api.x.ai/v1" });
}

const PDF_PATH = "docs/Standard Documents/SA-2017-Entire.pdf";
const OUTPUT_PATH = "lib/standard-forms/sa-2017.json";
const STANDARD_FORM_VERSION = "SA-2017";

// Deterministic page-range chunks — read once off the printed Table of
// Contents (PDF page 3) and confirmed against each section's actual starting
// page via a one-off per-page header scan. Boundaries are NOT inferred by
// the LLM; deterministic page ranges are far more reliable than asking a
// model to detect section breaks in running legal text. Ground truth: the
// PDF itself, pages 1-51 (pages 1-3 are cover/foreword/ToC, excluded).
const CHUNKS = [
  { part: "Subcontract Agreement", section: "Subcontract Agreement", topicBucket: "subcontract_agreement", startPage: 4, endPage: 4 },
  { part: "Specific Conditions", section: "Subcontract Specific Conditions (Clauses 2-12 schedule)", topicBucket: "specific_conditions_schedule", startPage: 5, endPage: 9 },
  { part: "General Conditions", section: "Section 1-2: Interpretation & Contracts", topicBucket: "interpretation_contracts", startPage: 10, endPage: 12 },
  { part: "General Conditions", section: "Section 3-4: Bonds & Sub-Letting", topicBucket: "bonds_subletting", startPage: 13, endPage: 14 },
  { part: "General Conditions", section: "Section 5: General Obligations (1 of 2)", topicBucket: "general_obligations", startPage: 15, endPage: 17 },
  { part: "General Conditions", section: "Section 5: General Obligations incl. 5.9 Health & Safety (2 of 2)", topicBucket: "general_obligations", startPage: 18, endPage: 19 },
  { part: "General Conditions", section: "Section 6: Design and Producer Statements", topicBucket: "design_producer_statements", startPage: 20, endPage: 20 },
  { part: "General Conditions", section: "Section 7-8: Indemnity & Insurance", topicBucket: "indemnity_insurance", startPage: 21, endPage: 23 },
  { part: "General Conditions", section: "Section 9: Variations", topicBucket: "variations", startPage: 24, endPage: 24 },
  { part: "General Conditions", section: "Section 10: Time", topicBucket: "time", startPage: 25, endPage: 26 },
  { part: "General Conditions", section: "Section 11: Defects", topicBucket: "defects", startPage: 27, endPage: 27 },
  { part: "General Conditions", section: "Section 12: Payments", topicBucket: "payments", startPage: 28, endPage: 29 },
  { part: "General Conditions", section: "Section 13-15: Disputes, Default & Urgent Work", topicBucket: "disputes_default_urgent", startPage: 30, endPage: 33 },
  { part: "General Conditions", section: "Section 16: Service of Notices", topicBucket: "notices_service", startPage: 34, endPage: 34 },
  { part: "Appendices", section: "Appendix A: Supply Only Subcontracts (clause amendments)", topicBucket: "appendix_a_supply_only", startPage: 35, endPage: 35 },
  { part: "Appendices", section: "Appendices B1-B4: Payment & Variation Claim Forms", topicBucket: "appendix_payment_forms", startPage: 36, endPage: 41 },
  { part: "Appendices", section: "Appendix D: Pre-Letting Meeting Minutes", topicBucket: "appendix_meeting_bonds", startPage: 42, endPage: 45 },
  { part: "Appendices", section: "Appendices E1-E3: Bonds", topicBucket: "appendix_meeting_bonds", startPage: 46, endPage: 51 }
];

const ExtractedClauseSchema = z.object({
  clauseRef: z.string(),
  title: z.string().nullable(),
  body: z.string(),
  pageNumber: z.number().int().nullable(),
  isFillIn: z.boolean()
});
const ExtractedClausesSchema = z.object({ clauses: z.array(ExtractedClauseSchema) });

const StandardFormClauseSchema = z.object({
  clauseRef: z.string(),
  part: z.string(),
  section: z.string(),
  topicBucket: z.string(),
  title: z.string().nullable(),
  body: z.string(),
  pageNumber: z.number().int().nullable(),
  isFillIn: z.boolean()
});
const StandardFormSchema = z.object({
  version: z.string(),
  sourceTitle: z.string(),
  generatedAt: z.string(),
  clauses: z.array(StandardFormClauseSchema)
});

async function extractChunkClauses(chunkText, chunkLabel) {
  const response = await getClient().chat.completions.create({
    model: GROK_MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          `You extract every individually-numbered clause, verbatim, from an excerpt of the "${chunkLabel}" section of a standard-form NZ construction subcontract agreement (SA-2017). ` +
          "Respond with only a JSON object matching this exact shape: " +
          '{"clauses": [{"clauseRef": string, "title": string | null, "body": string, "pageNumber": number | null, "isFillIn": boolean}]}. ' +
          "clauseRef: the clause's printed number exactly as shown, e.g. '5.9.1', '8.4.2', '16.1.1', or a schedule item label if unnumbered. " +
          "title: a short heading for the clause if the document gives one nearby, else null. " +
          "body: the clause's full text, verbatim — do not summarize, paraphrase, or omit any clause in this excerpt, however minor. " +
          "pageNumber: the text below contains '--- PAGE N ---' markers showing where each source page begins — use the marker immediately before the clause to report its correct page number. Never guess a page number from the clause's numbering; only use the markers. " +
          "isFillIn: true if this is a blank/fill-in schedule item from the Specific Conditions (a party fills in a number, date, or yes/no), false for fixed General Conditions boilerplate. " +
          "Extract every clause in this excerpt — do not skip any, even short or seemingly minor ones."
      },
      { role: "user", content: chunkText }
    ]
  });
  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error(`No response from Grok for chunk "${chunkLabel}".`);
  return ExtractedClausesSchema.parse(JSON.parse(raw)).clauses;
}

async function main() {
  if (!process.env.XAI_API_KEY) {
    throw new Error("XAI_API_KEY is not set (check .env).");
  }

  console.log("Reading PDF...");
  const buffer = await readFile(PDF_PATH);
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const { pages } = await parser.getText();
  await parser.destroy();
  console.log(`Read ${pages.length} pages.`);

  const allClauses = [];
  for (const chunk of CHUNKS) {
    const chunkText = pages
      .filter((p) => p.num >= chunk.startPage && p.num <= chunk.endPage)
      .map((p) => `--- PAGE ${p.num} ---\n${p.text}`)
      .join("\n\n");
    console.log(`Extracting "${chunk.section}" (pages ${chunk.startPage}-${chunk.endPage}, ${chunkText.length} chars)...`);
    const clauses = await extractChunkClauses(chunkText, chunk.section);
    console.log(`  -> ${clauses.length} clauses`);
    for (const clause of clauses) {
      allClauses.push({
        ...clause,
        part: chunk.part,
        section: chunk.section,
        topicBucket: chunk.topicBucket,
        pageNumber: clause.pageNumber ?? chunk.startPage
      });
    }
  }

  const standardForm = {
    version: STANDARD_FORM_VERSION,
    sourceTitle:
      "SA-2017 Subcontract Agreement (Registered Master Builders Association of New Zealand Inc / New Zealand Specialist Trade Contractors Federation Inc)",
    generatedAt: new Date().toISOString(),
    clauses: allClauses
  };

  // Fail loudly rather than write a corrupt/incomplete baseline.
  StandardFormSchema.parse(standardForm);

  await writeFile(OUTPUT_PATH, JSON.stringify(standardForm, null, 2));
  console.log(`\nWrote ${allClauses.length} clauses across ${CHUNKS.length} chunks to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
