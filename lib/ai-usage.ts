import { prisma } from "./prisma";

// Plain string union, not a Prisma enum — matches this codebase's existing
// "extensible preset list" convention (see lib/trades.ts's TRADE_PRESETS,
// lib/inbound-email-types.ts) so a new AI feature can start logging without
// a migration. contract_review deliberately aggregates every Grok call
// inside the internal contract-review pipeline (clause extraction, SA-2017
// bucket comparisons, synthesis, terms extraction, prior-contract
// comparison, required-cover extraction) into one commercially-meaningful
// tag — a founder asking "what does Contract Review cost us" doesn't care
// that it's internally six separate calls. Response-letter drafting is kept
// separate since it's a distinct, user-initiated action with its own cost
// profile. Note: the task brief's seed list included a "Scope extraction"
// feature — no such AI call exists anywhere in the codebase (confirmed via
// a full grep of every Grok call site); only Programme extraction does.
export const AI_FEATURES = [
  "contract_review",
  "contract_review_response_letter",
  "programme_extraction",
  "variation_site_instruction_extraction",
  "insurance_extraction",
  "incoming_email_classification",
  "update_thread_summary",
  "external_update_draft",
  "voice_transcription"
] as const;

export type AiFeature = (typeof AI_FEATURES)[number];

// organisationId/userId are optional and unvalidated on purpose — several
// call chains (contract review, document processing, the inbound-email
// webhook/cron sweep) run fire-and-forget, detached from any HTTP request,
// and genuinely don't always have one or both at the point the AI call
// fires. contextRef is a deliberately cheap, free-text trace-back (e.g. a
// contractReviewId or documentId) for spotting an outlier later — not a
// relation, per the instruction not to over-engineer it.
export type AiUsageContext = {
  feature: AiFeature;
  organisationId?: string | null;
  userId?: string | null;
  contextRef?: string | null;
};

async function computeCostUsd(model: string, promptTokens: number, completionTokens: number): Promise<number | null> {
  const pricing = await prisma.aiModelPricing.findUnique({ where: { model } });
  if (!pricing) return null;
  const inputCost = (promptTokens / 1_000_000) * Number(pricing.inputPricePerMillion);
  const outputCost = (completionTokens / 1_000_000) * Number(pricing.outputPricePerMillion);
  return inputCost + outputCost;
}

// Called by lib/grok.ts's callGrok wrapper (and lib/transcription.ts's own
// STT call, which has no token counts) after a successful response.
// Deliberately swallows its own errors — a logging failure must never take
// down the real AI call it's observing.
export async function recordAiUsageSuccess(params: {
  context: AiUsageContext;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
}): Promise<void> {
  try {
    const costUsd =
      params.promptTokens != null && params.completionTokens != null
        ? await computeCostUsd(params.model, params.promptTokens, params.completionTokens)
        : null;

    await prisma.aiUsageLog.create({
      data: {
        feature: params.context.feature,
        organisationId: params.context.organisationId ?? null,
        userId: params.context.userId ?? null,
        model: params.model,
        promptTokens: params.promptTokens,
        completionTokens: params.completionTokens,
        totalTokens: params.totalTokens,
        costUsd,
        success: true,
        contextRef: params.context.contextRef ?? null
      }
    });
  } catch (error) {
    console.error("Failed to record AI usage (success):", error);
  }
}

export async function recordAiUsageFailure(params: { context: AiUsageContext; model: string; error: unknown }): Promise<void> {
  try {
    const errorMessage = params.error instanceof Error ? params.error.message.slice(0, 500) : "Unknown error";
    await prisma.aiUsageLog.create({
      data: {
        feature: params.context.feature,
        organisationId: params.context.organisationId ?? null,
        userId: params.context.userId ?? null,
        model: params.model,
        success: false,
        errorMessage,
        contextRef: params.context.contextRef ?? null
      }
    });
  } catch (error) {
    console.error("Failed to record AI usage (failure):", error);
  }
}
