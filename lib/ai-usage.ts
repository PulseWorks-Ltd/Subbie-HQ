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

// Thrown by assertWithinSpendCap below and caught by every AI-calling route
// specifically (via `instanceof`) so its message — safe to show a user
// as-is — replaces whatever generic fallback message that route would
// otherwise return, rather than getting swallowed by it.
export class AiSpendCapExceededError extends Error {
  constructor(
    public readonly organisationId: string,
    public readonly capUsd: number,
    public readonly spentUsd: number
  ) {
    super("Your organisation has reached its AI usage limit for this month. Contact support to increase your limit.");
    this.name = "AiSpendCapExceededError";
  }
}

// Exported so lib/ai-usage-queries.ts's dashboard queries use the exact
// same "current calendar month" boundary as the cap check itself — a
// mismatch here would make the dashboard's spend-vs-cap display lie about
// what actually gets blocked.
export function currentMonthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

// Pilot-phase safety net, not real billing — sums this org's logged AI cost
// for the current calendar month (failed calls carry no costUsd, so they
// never count against it) and throws if it's already at or past the cap.
// Called once, at the very top of lib/grok.ts's callGrok AND
// lib/transcription.ts's transcribeAudio — the two physically separate
// places an AI call actually fires — but the query/threshold logic itself
// lives here, in exactly one place. No organisationId (a legacy project
// with no org) or a null cap on the org (the platform owner's override,
// see /platform-admin/ai-usage) both mean "no cap enforced."
export async function assertWithinSpendCap(organisationId: string | null | undefined): Promise<void> {
  if (!organisationId) return;

  const org = await prisma.organisation.findUnique({
    where: { id: organisationId },
    select: { aiMonthlySpendCapUsd: true }
  });
  if (!org || org.aiMonthlySpendCapUsd === null) return;

  const capUsd = Number(org.aiMonthlySpendCapUsd);
  const result = await prisma.aiUsageLog.aggregate({
    where: { organisationId, createdAt: { gte: currentMonthStart() } },
    _sum: { costUsd: true }
  });
  const spentUsd = Number(result._sum.costUsd ?? 0);

  if (spentUsd >= capUsd) {
    throw new AiSpendCapExceededError(organisationId, capUsd, spentUsd);
  }
}

// Powers the /platform-admin/ai-usage "By organisation" spend-vs-cap
// display — same month-to-date sum assertWithinSpendCap computes, exposed
// for reading rather than enforcing.
export async function getOrgMonthToDateSpend(organisationId: string): Promise<number> {
  const result = await prisma.aiUsageLog.aggregate({
    where: { organisationId, createdAt: { gte: currentMonthStart() } },
    _sum: { costUsd: true }
  });
  return Number(result._sum.costUsd ?? 0);
}

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
