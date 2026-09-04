# Subbie HQ — Retention Management V2: Architecture Review + Implementation Plan

**✅ IMPLEMENTED (same session, immediately after this plan was approved).** Every section below shipped as designed, in the recommended order (§16), with one naming refinement caught during implementation and one real extraction nuance worth flagging:

- Both migrations applied to staging (the rename + additive fields, then a small follow-up adding `initialReleaseAnchorEndOfMonth`/`finalReleaseAnchorEndOfMonth` — needed to correctly compute the SA-2017 baseline's own "22 working days after the **end of the month**..." timing, which §6.2 flagged as requiring an anchor concept but hadn't yet turned into a concrete field).
- `lib/retention-dates.ts`, `computeRetentionStatus`, `confirmCompletionOfWorks`, `RetentionEvidenceLink`, `extractRetentionTermsFromClauses`, the Contract Terms settings UI, and the Retention card all built as specified.
- **Verified with 33 real staging assertions**, including a real Grok call extracting retention terms from the actual SA-2017 baseline text already in this repo — it correctly classified the trigger as `completion_of_subcontract_works`, captured "22 Working Days after the end of the month..." with `anchorEndOfMonth: true`, and correctly did NOT flag the conforming mechanism as requiring review.
- **One real nuance surfaced by that same real extraction**, not a bug: SA-2017's final release trigger ("completion of the defects liability period, or rectification of all defects, whichever is later") doesn't cleanly fit any of the 7 `RetentionReleaseTrigger` values — the model reasonably chose `other_event` as the closest fit, and `requiresReview` correctly stayed `false` since this genuinely isn't a CCA-concerning trigger, just a legitimate DLP-expiry condition the enum has no dedicated label for yet. Worth a future `defects_liability_period_expiry` enum value if this pattern recurs — additive, per §14's own design, not done now.

---

**Below is the plan as originally written and approved. No code, schema, migrations, UI, or config were changed to PRODUCE this document — see the implementation status above for what was subsequently built from it.**

This plan was written after inspecting the actual current codebase (schema, lib files, routes, components) rather than assuming its shape. Every recommendation below cites the real file/model it touches. Where I found something worth reusing as-is, I say so explicitly. Where I found something built earlier this session that this plan revises, I explain why before recommending the change.

---

## 1. EXECUTIVE SUMMARY

Subbie HQ already has a **working V1 retention feature**, built earlier this session: a `Retention` model (two tranches, percentages, dates, released amounts), a live-computed "total withheld" figure derived from real `PaymentClaim` rows, a summary card on the Payment Claims page, Dashboard feed entries, and reminder wiring through the existing `lib/reminders.ts` engine. This is **not a green-field build** — it's a substantial upgrade of something real and already in production-shaped code.

What's missing, and what this plan designs, is the **contract-aware layer** this brief asks for:

1. **Structured extraction** of the actual retention mechanism from an uploaded subcontract (rate, cap, initial-release trigger and timing, defects period, final-release trigger and timing, clause references) — today `ContractTerms.retentionPercent`/`defectsLiabilityPeriodDays` are the only extracted retention facts; there is no extraction of *triggers* or *timing mechanisms* at all.
2. **A distinct, explicitly-labelled completion event** ("completion of the Subcontract Works," not "Practical Completion," not "final account," not "head contract PC") — V1 conflates this with `Project.completedAt` under a field literally named `practicalCompletionDateOverride`, which risks exactly the terminology confusion this brief warns against (Section 2/17). **This plan recommends renaming and reframing that field** — see §3.4.
3. **Working-day-aware date calculation** — confirmed by direct inspection: **no such utility exists anywhere in this codebase.** `lib/day-works-rates.ts`'s `isRecognisedHolidayOrSunday` only recognises Sundays; there is no NZ public holiday calendar. This is a real, current gap, not something this plan can quietly assume away.
4. **A "requires review" signal for unusual retention clauses** — the existing Contract Review deviation-comparison pipeline (`lib/grok.ts`'s `compareClausesToStandardBucket`, `ContractDeviation` model) already runs a clause-by-clause comparison against the SA-2017 baseline and already has the right shape (severity, category, rationale, recommendation) to carry this — but its prompt is generic ("shifts risk onto the subcontractor") and has no specific instruction to recognise a CCA-s.20-flavoured retention-release problem. This plan adds a small, targeted retention-specific extraction pass rather than trying to bend the generic comparison prompt to a job it isn't scoped for.

The core finding that shapes this whole plan: **the existing `Retention` model, `PaymentClaim` architecture, `ExternalAction` framework, `RecordLifecycleEvent` audit log, and `lib/reminders.ts` engine are all sufficiently mature to carry this feature with additive, not architectural, changes.** No new subsystem is needed. The real work is: extend `ContractTerms`/`Retention` with the missing structured fields, add one new extraction function, add one small date-utility module, add a completion-confirmation step, and reuse everything else.

---

## 2. CURRENT ARCHITECTURE FINDINGS

### 2.1 What already exists and works (confirmed by direct inspection)

| Area | File(s) | Finding |
|---|---|---|
| Retention model | `prisma/schema.prisma` (`model Retention`, ~line 1182) | One row per project. Two explicit tranches (`tranche1*`/`tranche2*`: expected date, percent, released amount, released date, `lastReminderStage`). `practicalCompletionDateOverride` field — **see §3.4, this needs renaming.** Total withheld is deliberately **not stored** anywhere. |
| Retention calculation | `lib/retention.ts` | `computeTotalRetentionWithheld(projectId)` — live sum of `Σ(PaymentClaim.claimedAmount) × ContractTerms.retentionPercent/100`. `getRetentionSummary(projectId)` — resolves tranche defaults (tranche 2 = tranche 1 + `defectsLiabilityPeriodDays`) and expected amounts. `computeNetRetentionCurrentlyHeld`/`computeTotalRetentionWithheldForMainContractor` — net (withheld minus released) rollup across a Main Contractor's projects. **All of this is reusable as-is or with small extension — no rewrite needed.** |
| Retention UI | `components/payment-claims/retention-card.tsx`, embedded in `components/payment-claims/payment-claims-list-view.tsx` | A card at the top of the Payment Claims list page: total withheld, per-tranche inline edit (share %, expected date, mark-released). **Reusable shell — needs new sections added (trigger explanation, completion confirmation, requires-review banner), not a rewrite.** |
| Retention API | `app/api/projects/[projectId]/retention/route.ts` | `GET` (summary), `PATCH` (upsert any tranche field). **Reusable, needs new fields added to the schema.** |
| Reminders | `lib/reminders.ts` | Generic `stageForDaysUntil`/`stageRank` (3-day/1-day/due-today/overdue) engine, already extended for Retention's two tranches and for `DelayEvent`'s notice deadline. **The exact same pattern applies to every new date this plan introduces — no new reminder mechanism needed.** |
| Dashboard | `lib/dashboard.ts` | Extensible `DashboardItemType` union + per-project loop already carries `"retention"` as a type (two synthetic items per project, one per tranche). **Extend the existing loop, don't add a parallel one.** |
| Contract extraction (generic terms) | `lib/grok.ts`'s `extractContractTermsFromClauses`, `lib/contract-comparison.ts` (the `suggestIfUnconfirmed`/`confirmFields` flow), `app/api/projects/[projectId]/contract-terms/route.ts`, `components/settings/contract-terms-section.tsx` | One AI call extracts a flat set of contract facts (payment claim method/day, notice periods, retention %, DLP days, etc.) into `ContractTerms`, each with a `suggested*` shadow field confirmed via a generic `confirmFields` mechanism. **This is the proven pattern to extend — not a new pipeline.** Confirmed: **no trigger/timing/cap structure is extracted today**, only the flat `retentionPercent`/`defectsLiabilityPeriodDays` numbers. |
| Contract Review deviation comparison | `lib/grok.ts`'s `compareClausesToStandardBucket`, `synthesizeContractReview`; `ContractReview`/`ContractDeviation`/`Clause` models; `lib/standard-forms/sa-2017.json` | A real, working map-reduce comparison against the SA-2017 baseline, bucketed by `topicBucket`, producing `ContractDeviation` rows with `classification`/`severity`/`category`/`rationale`/`recommendation`. Retention clauses (SA-2017 clauses 12.4, 12.4.1, 12.4.2, and the Specific Conditions Schedule's retention/DLP/release-date fill-ins) already live in `topicBucket: "payments"` / `"specific_conditions_schedule"` and are already compared. **This already catches gross wording deviations generically** but has no specific instruction to recognise a CCA-relevant "release conditioned on the wrong event" pattern — see §4.4. |
| SA-2017 baseline retention structure | `lib/standard-forms/sa-2017.json` | Confirmed the exact structure this brief's "attached contract example" describes already exists in the baseline: clause 10.4 ("Completion of the Subcontract Works" — 10.4.1 subcontractor notifies, 10.4.2 Contractor inspects and within 15 working days either (a) issues a notice of the completion date or (b) issues a notice of remaining work), clause 12.4/12.4.1/12.4.2 (retention mechanics, two-stage release), and the Specific Conditions Schedule fill-ins for retention %/tiering, DLP %, "due date for initial retention release" (`22 Working Days after the end of the month in which the notice of completion of the Subcontract Works under clause 10.4.2(a) is issued`), and "due date for final retention release" (`25 Working Days after the completion of the defects liability period, or seven working days after completion of rectification of all defects, whichever is later`). **This is the concrete, real vocabulary this plan's extraction schema is built around** — not a generic guess at contract language. |
| Payment Claims | `PaymentClaim` model, `lib/payment-claim.ts`, `app/api/projects/[projectId]/payment-claims/*`, `components/payment-claims/*` | `claimedAmount` = one claim period's own new value (contract works + variations, computed, never typed separately — see the model's own schema comment). `status`: `draft \| issued \| responded`. **Confirmed gap**: `computeTotalRetentionWithheld` currently sums **every** claim regardless of status, including `draft` — see §11.3 for the recommendation. |
| Evidence architecture | `ClaimEvidenceLink` model + `ClaimEvidenceType` enum (`variation_package \| correspondence \| external_action \| qa_record \| update`), `lib/payment-claim.ts`'s `linkClaimEvidence`/`getClaimEvidence` | A real, working, polymorphic evidence-linking mechanism already exists for `PaymentClaim`. **Reusable directly for retention** — see §8. |
| ExternalAction (secure-link) | `ExternalAction` model, `lib/external-action.ts` | Confirmed a mature, generalised framework: mutually-exclusive target fields (`variationItemId \| dayWorksSheetId \| variationPackageId \| hoursOnSiteSheetId \| delayEventId`), `computeValueSnapshot`, `createAndSendExternalAction`, `getExternalActionForToken`, a public no-login response page. Just extended this session for `DelayEvent`. **The same extension pattern applies if retention ever needs an external send** (see §14) — not needed for V1's internal-only completion confirmation. |
| Lifecycle / audit | `RecordLifecycleEvent` model, `lib/record-lifecycle-log.ts` | A real, working, single shared audit table across `variation_item \| task \| project`, with free-text `previousState`/`newState` (deliberately not FK'd to any one entity's status enum, specifically because different entities have different vocabularies). **This is exactly the mechanism the brief asks to reuse** — confirmed the closed `RecordLifecycleEntityType`/`RecordLifecycleEventType` enums need one small additive migration each — see §3.5. |
| Project closure / archive | `lib/project-lifecycle.ts` (`reviewProjectForClosure`), `lib/archive-queries.ts` (`getArchiveMonths`, `getArchiveRecordsForMonth`, `ARCHIVE_RECORD_TYPES`) | Confirmed: **the Archive UI itself is not yet wired to any page** — `lib/archive-queries.ts` is real, tested-shape business logic with no route/page consuming it yet (same finding as an earlier gap-analysis this session). Confirmed: closing/archiving a `Project` does **not** restrict or hide access to that project's `PaymentClaim`/`Retention` data anywhere in the current code — there is no cascade, no access gate keyed off `Project.status`. **This means retention data is already durably accessible after project closure, today, with zero extra work** — see §10. |
| Permissions | `lib/permissions.ts` | `payment_claims` module already gates the Retention card (it lives on the Payment Claims page). No new module needed. |
| Date utilities | `lib/day-works-rates.ts` | Confirmed: **no working-day arithmetic utility exists anywhere in this codebase.** `isRecognisedHolidayOrSunday` returns true only for Sundays (`date.getUTCDay() === 0`) — no NZ public holiday calendar. `Organisation.jurisdiction` exists as a schema field specifically earmarked (per its own comment) for this future purpose but is read by nothing today. **This is a real, current gap this plan must build a small utility for** — see §6. |

### 2.2 What this plan revises from the V1 build, and why

**Finding: `Retention.practicalCompletionDateOverride` is misleadingly named for what this brief requires.**

V1 built this field to mean "the date retention's first tranche is released against," defaulting to `Project.completedAt`. That's functionally the right proxy (both describe the subbie's own scope of work finishing, not the head contract or final account), but the field's *name* borrows NZS3910-style "Practical Completion" language, which is a **head-contract** concept under other NZ standard forms and is explicitly the wrong term for what SA-2017 clause 10.4 calls "completion of the Subcontract Works." Section 2 and Section 17 of this brief are explicit that these must not be conflated — and a field name is exactly the kind of thing that quietly reintroduces the conflation for a future maintainer or, worse, in UI copy shown to a user. **Recommendation: rename this concept (migration-safe, see §11) to make "completion of the Subcontract Works" a first-class, correctly-labelled concept, distinct in name as well as function from Practical Completion.**

This is the only "undo a prior decision" this plan makes. Everything else in V1 is retained and extended.

---

## 3. RECOMMENDED RETENTION MODEL

### 3.1 Where retention terms live: extend `ContractTerms`, don't create a new "Retention Terms" model

The brief's suggested conceptual chain (`PROJECT → CONTRACT RETENTION TERMS → RETENTION LEDGER → ...`) maps naturally onto **existing** models rather than a new one:

- **"Contract Retention Terms"** = new fields on the existing `ContractTerms` model (one row per project already; already carries `retentionPercent`/`defectsLiabilityPeriodDays`; already has the `suggested*` shadow-field pattern this needs). A brand-new "RetentionTerms" model would duplicate `ContractTerms`'s entire suggest/confirm machinery for no benefit — `ContractTerms` **is** the contract-terms model.
- **"Retention Ledger"** = the existing `Retention` model, extended. It is not a ledger in the accounting sense (no debits/credits) — it's a small state-and-dates row, which is exactly what the brief asks for ("do NOT build a double-entry accounting system").

This confirms the brief's own instruction ("determine whether the existing architecture needs a dedicated Retention model or whether retention can initially be represented through an appropriate extension") — the answer is: **keep the dedicated `Retention` model (state/dates/status), and extend `ContractTerms` (contract facts)**. Two models, matching the two genuinely different concerns (what the contract says, vs. what has actually happened on this project), consistent with how `ContractTerms` and `PaymentClaim` are already kept separate.

### 3.2 `ContractTerms` — new fields

All new fields follow the exact existing pattern: a real field + a `suggested*` shadow field, both nullable, confirmed via the existing generic `confirmFields` mechanism in `app/api/projects/[projectId]/contract-terms/route.ts`.

```prisma
model ContractTerms {
  // ... existing fields unchanged ...

  // Whether retention applies at all — a real subcontract may specify a
  // bond in lieu of retention instead (SA-2017 clause 3.1.1/3.2.1), in
  // which case retentionPercent being null is a genuine "not applicable"
  // fact, not an unconfirmed extraction. Tri-state: null = not yet
  // determined either way.
  retentionApplies              Boolean?
  suggestedRetentionApplies     Boolean?

  // Retention cap — "5% until total retention reaches $50,000" style
  // provisions. Both null = no cap stated (retention accrues
  // indefinitely at retentionPercent, today's V1 behaviour, unchanged).
  retentionCapAmount            Decimal? @db.Decimal(12, 2)
  suggestedRetentionCapAmount   Decimal? @db.Decimal(12, 2)

  // Initial release — the FIRST tranche's contractual trigger and timing.
  // Trigger is a small closed enum (see §3.3) so the completion-event
  // logic (§5) can branch on it reliably; timing is free-form because
  // real contracts express it inconsistently ("22 working days after the
  // end of the month in which...", "on issue of the Completion
  // Certificate", "within 10 business days of practical completion").
  initialReleasePercent          Float?
  suggestedInitialReleasePercent Float?
  initialReleaseTrigger          RetentionReleaseTrigger?
  suggestedInitialReleaseTrigger  RetentionReleaseTrigger?
  // Structured where possible (see RetentionTimingSpec in §3.3), else the
  // raw contractual sentence — never silently dropped.
  initialReleaseTimingDays        Int?
  initialReleaseTimingUnit        RetentionTimingUnit?
  initialReleaseTimingDescription String?
  suggestedInitialReleaseTimingDays        Int?
  suggestedInitialReleaseTimingUnit        RetentionTimingUnit?
  suggestedInitialReleaseTimingDescription String?

  // Final release — same shape as initial release, for the second tranche.
  finalReleasePercent          Float?
  suggestedFinalReleasePercent Float?
  finalReleaseTrigger          RetentionReleaseTrigger?
  suggestedFinalReleaseTrigger RetentionReleaseTrigger?
  finalReleaseTimingDays          Int?
  finalReleaseTimingUnit          RetentionTimingUnit?
  finalReleaseTimingDescription   String?
  suggestedFinalReleaseTimingDays        Int?
  suggestedFinalReleaseTimingUnit        RetentionTimingUnit?
  suggestedFinalReleaseTimingDescription String?

  // Which clause(s) actually state this, for the "what does my contract
  // say" trace-back (Section 1's objective) — free text, not a Clause
  // FK, since the source may be the Specific Conditions Schedule (a
  // fill-in table, not prose clauses) as often as the General
  // Conditions. Matches how Clause.sourceRef/pageNumber already work —
  // this is deliberately lighter (a label, not a full citation object)
  // since it's for display, not for re-deriving anything.
  retentionClauseReference        String?
  suggestedRetentionClauseReference String?

  // Set true when the retention-terms extraction (§4) judged the
  // release trigger/timing genuinely unusual enough to need human
  // review — see §4.4. Deliberately NOT a legal-validity judgement; the
  // extraction's own notes field carries the actual explanation.
  retentionRequiresReview        Boolean  @default(false)
  retentionReviewNotes            String?
}

// A small, closed set — NOT every possible contractual phrase, just
// enough to answer "is this the SA-2017-conforming trigger, or
// something the brief specifically warns about." head_contract_event
// and other_event are the ones that should usually set
// retentionRequiresReview (see §4.4) — they describe a release
// conditioned on something outside the subcontractor's own performance
// of ITS OWN obligations, which is the exact CCA s.20 concern this brief
// raises. completion_of_subcontract_works is the SA-2017-conforming
// case (clause 10.4.2(a)) and is deliberately kept distinct from
// practical_completion_subcontractor (some non-SA-2017 forms use
// "practical completion" to mean the same subcontractor-scoped thing,
// just under different wording — not itself a red flag).
enum RetentionReleaseTrigger {
  completion_of_subcontract_works
  practical_completion_subcontractor
  final_payment_claim
  final_account
  head_contract_event
  other_event
  not_stated
}

enum RetentionTimingUnit {
  working_days
  calendar_days
  weeks
  months
}
```

### 3.3 `Retention` — new/renamed fields

```prisma
model Retention {
  id        String @id @default(cuid())
  projectId String @unique

  // RENAMED from practicalCompletionDateOverride — see §2.2. Same
  // fallback behaviour (defaults from Project.completedAt when null),
  // same purpose, correctly-labelled name. A real migration renaming a
  // column, not a new column — see §11.2 for the exact migration.
  completionOfWorksDateOverride DateTime?

  // NEW — the explicit confirmation action Section 8 asks for,
  // distinct from just reading Project.completedAt passively. Recorded
  // even when it happens to match Project.completedAt exactly, so
  // there's always a real "yes, I confirm this" event on file, not an
  // inferred one. userId + at, mirroring every other "who/when
  // confirmed this" field already in this schema (e.g.
  // VariationItem.closedByUserId/closedAt).
  completionOfWorksConfirmedAt       DateTime?
  completionOfWorksConfirmedByUserId String?

  // Free text — "how do we actually know this," independent of the
  // Confirm action itself (evidence LINKS live via ClaimEvidenceLink,
  // see §8; this is just the human-readable one-liner, same role as
  // DelayEvent.cause).
  completionOfWorksNote String?

  // Tranche 1 — unchanged shape, still editable per-tranche regardless
  // of what ContractTerms extracted (a schedule can genuinely differ
  // from the general conditions in a real contract).
  tranche1ExpectedDate      DateTime?
  tranche1Percent           Float?
  tranche1ReleasedAmount    Decimal?       @db.Decimal(12, 2)
  tranche1ReleasedAt        DateTime?
  tranche1LastReminderStage ReminderStage?

  // Tranche 2 — unchanged shape.
  tranche2ExpectedDate      DateTime?
  tranche2Percent           Float?
  tranche2ReleasedAmount    Decimal?       @db.Decimal(12, 2)
  tranche2ReleasedAt        DateTime?
  tranche2LastReminderStage ReminderStage?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  project             Project @relation(fields: [projectId], references: [id])
  confirmedByUser      User?   @relation(fields: [completionOfWorksConfirmedByUserId], references: [id])
}
```

**Deliberately not added**: a `status` column. Status (§7/§10) is **computed**, not stored — exactly the same reasoning V1 already applied to "total withheld" (never store what can be correctly derived, because a stored copy can drift). See §7.1 for the computation.

### 3.4 Why extend rather than replace

Every one of V1's existing computations (`computeTotalRetentionWithheld`, the net-held rollup, the Dashboard/reminder wiring) keeps working unchanged — they never read `practicalCompletionDateOverride`/the trigger fields directly, only the tranche dates/percentages/released amounts, none of which change shape. The rename and the new fields are additive from their point of view.

---

## 4. CONTRACT EXTRACTION CHANGES

### 4.1 New extraction function: `extractRetentionTermsFromClauses`

A new function in `lib/grok.ts`, sitting alongside (not replacing) `extractContractTermsFromClauses` — kept separate because retention's extraction is meaningfully richer (structured triggers, tiered rates, cap detection, a review-flag) than the one-line-per-fact shape the generic terms extraction already handles well for everything else. Mirrors that function's exact conventions: runs on the same already-extracted `Clause[]` from Contract Review's Step 0 (no new PDF parsing), one Grok call, `feature: "contract_review"` tag (same AI-usage bucket, no new `AiFeature` value needed).

```ts
const RetentionTimingSchema = z.object({
  days: z.number().int().nullable(),
  unit: z.enum(["working_days", "calendar_days", "weeks", "months"]).nullable(),
  description: z.string().nullable() // the raw contractual sentence, always populated even when days/unit parse cleanly
});

const ExtractedRetentionTermsSchema = z.object({
  retentionApplies: z.boolean().nullable(),
  retentionPercent: z.number().nullable(),
  retentionCapAmount: z.number().nullable(),
  defectsLiabilityPeriodDays: z.number().int().nullable(),
  initialReleasePercent: z.number().nullable(),
  initialReleaseTrigger: z.enum([
    "completion_of_subcontract_works", "practical_completion_subcontractor",
    "final_payment_claim", "final_account", "head_contract_event", "other_event", "not_stated"
  ]).nullable(),
  initialReleaseTiming: RetentionTimingSchema.nullable(),
  finalReleasePercent: z.number().nullable(),
  finalReleaseTrigger: z.enum([/* same set */]).nullable(),
  finalReleaseTiming: RetentionTimingSchema.nullable(),
  clauseReference: z.string().nullable(),
  requiresReview: z.boolean(),
  reviewNotes: z.string().nullable() // populated whenever requiresReview is true; explains WHY in plain language
});
```

**Prompt design principles (grounded in the SA-2017 baseline text actually in this repo, `lib/standard-forms/sa-2017.json`):**

- Explicitly tell the model the SA-2017-conforming shape as a *reference point for comparison*, not as the only valid shape: "a standard NZ subcontract conditions retention release on **completion of the Subcontract Works** — a defined event where the subcontractor notifies completion and the Contractor issues a notice confirming the completion date (often numbered similarly to clause 10.4) — not on the head contract reaching practical completion, not on submission of a final payment claim, and not on the final account being agreed."
- Instruct it to classify the trigger into the closed `RetentionReleaseTrigger` enum by what the clause **actually conditions release on**, not by what label the contract happens to use — a clause calling its own trigger "Practical Completion" but defining it as "when the Subcontractor's own scope is complete" is `practical_completion_subcontractor`, not a red flag; a clause conditioning subcontractor release on the **head contract's** PC certificate is `head_contract_event`.
- `requiresReview: true` whenever the trigger is `head_contract_event` or `other_event` (release contingent on something outside the subcontractor's own performance of its own obligations — the exact CCA s.20 pattern this brief flags), **or** when release timing is stated as "at the Contractor's discretion"/has no objective date-fixing mechanism at all, **or** when no defects-period end date or release mechanism is stated at all despite retention clearly applying.
- Never invent a percentage, cap, or date it can't support from the text — same "use null, not a guess" discipline already enforced throughout `lib/grok.ts` (e.g. `variationScheduleType`'s own prompt comment: "this drives an automated external send, so an invented number is worse than none").
- `reviewNotes`, when populated, must use the brief's own required hedged framing — encoded directly in the prompt: *"Phrase any review note as 'this provision may require review under the Construction Contracts Act 2002' or similar — never assert that a clause is illegal or unenforceable."*

### 4.2 Where it's called from

`lib/contract-comparison.ts`'s existing contract-processing pipeline, in the same place `extractContractTermsFromClauses` is already called (confirmed at `lib/contract-comparison.ts:368`) — one more `await` alongside it, not a new pipeline stage. Its result feeds the same `suggestIfUnconfirmed`/`confirmData` upsert into `ContractTerms` that every other extracted field already goes through (§3.2's fields, all with `suggested*` shadows).

### 4.3 Confidence / ambiguity handling

Reuses the existing pattern exactly: nothing is written to a *confirmed* field directly, only to its `suggested*` shadow, unless that real field is currently null (`suggestIfUnconfirmed`, already implemented and unit-tested in spirit by the existing Contract Terms flow). A human always confirms before a suggested retention term becomes the value driving date calculations — consistent with `variationScheduleType`'s own stated reasoning ("this drives an automated external send, so an invented number is worse than none") applying just as much here, since these numbers drive *when a subcontractor is told money should have arrived*.

### 4.4 Contract Review "requires review" surfacing

Two independent, complementary signals reach the user, not one bent-out-of-shape mechanism:

1. **The generic deviation comparison** (`ContractDeviation`, unchanged) still runs and will usually flag a retention clause that differs *substantially* from SA-2017 as a `major_deviation`/`critical` finding in its ordinary flow — this already works today, needs no change.
2. **The new `retentionRequiresReview`/`retentionReviewNotes` fields on `ContractTerms`** (§3.2, §4.1) carry the *specific*, structured "this release trigger looks like it depends on something other than your own performance" signal that a generic deviation-comparison prompt (scoped to "does this clause differ from the standard form," not "does this clause raise a CCA s.20 concern") isn't well-placed to phrase precisely. This shows on the Retention card (§9.3) directly, in the brief's required hedged language, sourced from `reviewNotes`.

---

## 5. PAYMENT CLAIM INTEGRATION

**No structural change to `PaymentClaim` itself.** Confirmed by inspection: `PaymentClaim.claimedAmount` already represents exactly the "work certified this period" figure the brief's worked example needs (§11 of the brief); `computeTotalRetentionWithheld` already derives withheld retention live from it. The brief's own example —

```
Claim #1: Work certified $100,000, Retention withheld $5,000, Net $95,000
Claim #2: Work certified $150,000, Retention withheld $7,500, Net $142,500
Running retention: $12,500
```

— is **already exactly what `getRetentionSummary`'s `totalWithheld` computes** (Σ of `claimedAmount × retentionPercent/100` across every claim). The "Net" per-claim figure is already shown on the Payment Claim detail page (`components/payment-claims/payment-claim-detail-view.tsx`, which already computes `thisClaimNet` including a retention deduction line — built this session, unchanged by this plan).

**One real refinement recommended**: filter `computeTotalRetentionWithheld`'s claim query to `status: { not: "draft" }`. A draft claim is a work-in-progress figure the subbie hasn't even issued yet; counting its retention as genuinely "withheld by the Main Contractor" overstates the real figure. This is a one-line `where` clause change in `lib/retention.ts`, not a schema change — flagged here as part of the plan rather than implemented now, per this pass's own "plan only" instruction.

**Released amounts are NOT written back onto any `PaymentClaim` row** — a release is a `Retention.tranche{1,2}ReleasedAmount`/`ReleasedAt` fact, connected to *which claim it showed up in* only via the evidence link (§8), not via a new FK on `PaymentClaim` itself. This avoids inventing a "this claim is the retention-release claim" concept that doesn't exist contractually (retention release is usually paid as a line item on whatever the next ordinary claim happens to be, not a dedicated claim type).

---

## 6. COMPLETION / RELEASE LOGIC

### 6.1 The completion event

Represented by `Retention.completionOfWorksConfirmedAt`/`completionOfWorksConfirmedByUserId`/`completionOfWorksNote` (§3.3), always distinct from — but pre-fillable from — `Project.completedAt`.

**UI flow** (implementing the brief's §8 exactly): once `ContractTerms.initialReleaseTrigger` is known (extracted or manually entered), the Retention card shows a trigger-aware prompt:

- `completion_of_subcontract_works` / `practical_completion_subcontractor`: *"Your contract ties your initial retention release to completion of the Subcontract Works. Have the Subcontract Works been completed?"* → **[Confirm completion]**, pre-filled with `Project.completedAt` if set, editable, with an optional note field (e.g. "per the Contractor's clause 10.4.2(a) notice dated —").
- `head_contract_event` / `other_event`: the same confirm action is still offered (the subbie still needs *some* date to work from) but the card additionally shows the requires-review banner (§4.4) so the subbie understands their contract's own trigger may not track their own completion at all.
- `final_payment_claim` / `final_account`: confirm action is offered but explicitly labelled with that trigger's own name, so the subbie isn't misled into thinking it's tied to their physical completion.
- `not_stated` / trigger unknown: falls back to today's V1 behaviour exactly (defaults from `Project.completedAt`, no trigger-specific copy).

Confirming writes `completionOfWorksConfirmedAt`, logs a `RecordLifecycleEvent` (§16), and (if `tranche1ExpectedDate` is null) triggers the date calculation below.

### 6.2 Date calculation

A new pure function module, `lib/retention-dates.ts`:

```ts
export function addWorkingDays(from: Date, days: number, isNonWorkingDay: (d: Date) => boolean): Date { ... }
export function computeReleaseDate(
  triggerDate: Date,
  timing: { days: number | null; unit: RetentionTimingUnit | null } | null
): Date | null { ... }
```

`computeReleaseDate` branches on `unit`: `months`/`weeks` = plain calendar arithmetic (already used elsewhere in this codebase, e.g. `Retention`'s existing tranche-2-default logic, `DelayEvent`'s `computeNoticeDeadline`); `calendar_days` = plain day arithmetic; **`working_days` = the one genuinely new capability**, requiring `addWorkingDays` and a real non-working-day predicate — see §6.3 for why this can't just reuse what exists today.

The brief's own worked example — *"22 Working Days after the end of the month in which completion occurs"* — is a **two-step** calculation (end-of-month anchor, then N working days from there), not a single offset. `computeReleaseDate` takes the trigger date already anchored to whatever the contract's own timing description implies; a second small helper, `endOfMonth(date)`, composes with `addWorkingDays` for this specific (very common, SA-2017-native) phrasing. Both steps are independently unit-testable (§12).

### 6.3 Working days — the real gap, and the minimum fix

Confirmed gap (§2.1): nothing in this codebase can currently answer "what date is 22 working days after X" — `isRecognisedHolidayOrSunday` only recognises Sundays. **This plan does not propose solving NZ public holidays generally in V1** (a full national+regional holiday calendar is real, ongoing maintenance work, and `Organisation.jurisdiction` — the field already earmarked for this — isn't consumed anywhere yet). Instead:

- `addWorkingDays` counts calendar days, skipping weekends only, by default — an honest, documented approximation, not a silent wrong answer.
- Where `Organisation.jurisdiction` is set (NZ region), a small **fixed, hard-coded table of NZ **national** public holidays** (not regional anniversary days, which genuinely do vary by region and are a real future scope item) is consulted too. This is a deliberately small, honest first step — national holidays (New Year's, Waitangi Day, Good Friday, Easter Monday, ANZAC Day, King's Birthday, Matariki, Labour Day, Christmas, Boxing Day) are a fixed, low-maintenance list; regional anniversary days are explicitly **not** attempted in V1.
- The computed release date is **always shown alongside its own basis** ("22 working days after [date], assuming weekends and NZ national public holidays only — please confirm with your contract if regional public holidays apply") — never presented as an unqualified fact, consistent with the brief's own instruction not to assert what the system can't actually verify.

This is the honest minimum: it correctly handles the SA-2017 baseline's own stated mechanism far better than calendar-day arithmetic would, without pretending to solve the general NZ holiday-calendar problem.

---

## 7. NOTIFICATION LOGIC

### 7.1 Status — computed, not stored

A new pure function, `computeRetentionStatus(retention, contractTerms)`, returns one of:

```
not_configured | accumulating | awaiting_completion | initial_release_due
| initial_release_overdue | in_defects_period | final_release_due
| final_release_overdue | fully_released
```

Computed the same way V1 already computes tranche expected-date defaults (§2.1) — read fresh every time from `Retention`/`ContractTerms`/today's date, never written to a column. `not_configured` covers the brief's Test 2 (no retention applies) — the UI (§9) simply doesn't render the retention section at all in that case, rather than rendering an empty/zeroed one.

### 7.2 Reminder mechanism — fully reused

No new reminder engine. `lib/reminders.ts`'s existing Retention block (already built this session, using the exact `stageForDaysUntil`/`stageRank`/`notifyRecipients`/`recipientsFor` machinery shared with Variations, Safety Documents, and Delay Events) is extended to read `tranche{1,2}ExpectedDate` exactly as it does today — **the completion-event/trigger work in this plan only changes *how* those dates get set, not how they get reminded on.** Message copy is updated to the brief's suggested tone ("Your initial retention release may now be due" / "Your remaining $X retention is now due under the retention terms recorded for this project" / "Check with the QS/project manager that your retention has been released") — a copy change in the existing `headline`/`detail` string construction, not a new code path.

---

## 8. EVIDENCE INTEGRATION

**No new evidence storage.** `ClaimEvidenceLink` (model + `lib/payment-claim.ts`'s `linkClaimEvidence`/`unlinkClaimEvidence`/`getClaimEvidence`) already resolves a polymorphic link across `variation_package | correspondence | external_action | qa_record | update` into a displayable, linkable row, keyed off a `paymentClaimId`.

**Recommendation**: broaden `ClaimEvidenceLink`'s key from `paymentClaimId`-only to an equally-simple polymorphic owner, OR — the smaller, more consistent change — give `Retention` its own `RetentionEvidenceLink` model that is a **structural copy** of `ClaimEvidenceLink` (same `evidenceType`/`evidenceId` shape, same five evidence kinds), rather than trying to make one model serve two unrelated owners. This matches this codebase's own established convention of small, purpose-specific link tables over one maximally-generic join table (see how `VariationItemClaimAllocation` and `ClaimEvidenceLink` are already two separate, purpose-specific tables rather than one generic "PaymentClaimLink" table). `getRetentionEvidence(retentionId, projectId)` mirrors `getClaimEvidence`'s resolver switch statement exactly — genuinely copy-paste-derived, not a new design.

This answers the brief's own framing directly: "when did we complete our contractual work" → the confirmed date + its linked evidence (a completion-certificate correspondence entry, a QA record, a Project Diary entry, a photo); "what evidence proves it" → the linked rows; "how much retention is being held / when should it release / has it been paid" → §5/§7's existing computations.

---

## 9. UI PLAN

All additions are to the **existing** Retention card (`components/payment-claims/retention-card.tsx`) and the existing Contract Terms settings section (`components/settings/contract-terms-section.tsx`) — no new page, no new nav item, consistent with the brief's "remains deliberately simple" instruction and this session's own precedent of not adding nav clutter for a rollup of data that already lives on an existing page.

### 9.1 Contract Terms settings (`components/settings/contract-terms-section.tsx`)
New fields added to the existing generic `FIELDS` array (the same config-driven form already used for every other Contract Terms fact) for: retention applies (Yes/No), retention %, retention cap, initial release % + trigger (a select, options = the `RetentionReleaseTrigger` labels) + timing, final release % + trigger + timing, clause reference. Manual entry (brief's §6) is this exact same form with nothing extracted yet — **no separate "manual entry" UI is needed**, since a never-extracted `ContractTerms` row and a manually-completed one are indistinguishable to every downstream computation, by design.

### 9.2 Retention card — default/simple presentation (brief §7)
When a clean, extracted-or-confirmed set of terms exists, the card's summary line is generated directly from the real values (never a generic assumption rendered as fact):

> **5% retained from progress payments.** Initial release: 50% when your Subcontract Works are completed. Remaining retention: 50%. Defects period: 12 months. Expected final release: 12 months after completion of your subcontract obligations. *Subbie HQ will notify you when your retention release dates are approaching or become due.*

### 9.3 Retention card — completion confirmation + requires-review banner
As designed in §6.1. The requires-review banner (only shown when `retentionRequiresReview` is true) uses `retentionReviewNotes` verbatim, prefixed with the fixed, non-alarmist framing: *"This provision may require review under the Construction Contracts Act 2002 — see below."*

### 9.4 Payment Claim detail page
No new section — the existing per-claim retention deduction line (already built this session) is unchanged. This plan's contribution is entirely upstream of that line (better-informed dates/triggers), not a new display surface on that page.

---

## 10. ARCHIVE INTEGRATION

Confirmed by inspection (§2.1): closing a `Project` today does not restrict access to its `PaymentClaim`/`Retention` data anywhere in the codebase, and the Archive UI itself (`lib/archive-queries.ts`) is not yet wired to any route. **Net effect: retention data is already durably accessible after project closure, with zero additional work required for V1** — nothing to build here beyond "never delete a `Retention` row," which is already true (no delete route exists for it today, and this plan doesn't add one).

**Recommended follow-up, once the Archive UI itself is actually built** (a separate, larger, already-identified gap — not part of this plan): add `"retention"` to `ARCHIVE_RECORD_TYPES` (`lib/archive-queries.ts`), or fold a retention summary line into the existing `"claims"` archive record type's row — a small addition at that time, not now.

---

## 11. MIGRATION PLAN

All migrations described here are **additive or renaming**, none destructive, consistent with every schema change made this session so far (`node scripts/with-staging-db.js` + `prisma migrate diff` + hand-saved migration + `prisma migrate deploy`, staging only, production left to the user — the established workflow, unchanged).

### 11.1 New enums
`RetentionReleaseTrigger`, `RetentionTimingUnit` — new types, zero impact on existing rows.

### 11.2 `Retention` — column rename
`practicalCompletionDateOverride` → `completionOfWorksDateOverride`. Prisma expresses this as an `ALTER TABLE ... RENAME COLUMN` when the field is renamed with `@map` unchanged and no other shape change — a genuinely safe, data-preserving rename (confirmed: the field is nullable, currently populated on very few — likely zero, given this was built the same session — real rows, so there is no realistic backfill risk even if it were a drop-and-recreate).

### 11.3 `Retention` — new columns
`completionOfWorksConfirmedAt`, `completionOfWorksConfirmedByUserId` (+ FK to `User`), `completionOfWorksNote` — all nullable, zero impact on existing rows.

### 11.4 `ContractTerms` — new columns
Every field in §3.2 — all nullable (or `@default(false)` for `retentionRequiresReview`), zero impact on existing rows. No existing `ContractTerms` row needs backfilling; extraction naturally populates the `suggested*` shadows on the next Contract Review run, exactly like every other field this pattern already covers.

### 11.5 `RecordLifecycleEntityType` / `RecordLifecycleEventType` — enum extension
Add `retention` to `RecordLifecycleEntityType`. Add one new value to `RecordLifecycleEventType` — recommend `milestone`, used generically for every dated retention event (`completion_confirmed`, `initial_release_recorded`, `final_release_recorded`, `terms_confirmed`), with the *specific* nature of the milestone carried in the already-free-text `newState` column (e.g. `newState: "initial_release_recorded"`) — consistent with how `previousState`/`newState` are already deliberately untyped strings specifically to span multiple entities' different vocabularies (per that model's own schema comment). This is additive to a Postgres enum (`ALTER TYPE ... ADD VALUE`), the same kind of change already made twice this session for `ExternalActionType`-adjacent work.

### 11.6 New model
`RetentionEvidenceLink` (§8) — new table, zero impact on anything existing.

### 11.7 Existing-project handling
No backfill needed anywhere. A project with no `ContractTerms.retentionPercent` set today continues to show exactly what it shows today (V1's existing "not yet configured" messaging); a project with V1's tranche data already entered keeps it, unchanged, under the renamed field.

---

## 12. TEST PLAN

Mirrors this session's established discipline: real staging data via a throwaway Organisation/Project (never production), pure-function unit tests run directly, `pdftotext`-style deterministic assertions where relevant, all test data cleaned up afterward, `npx tsc --noEmit` as a hard gate. No test described here has been run — this is the plan for the next, implementation, pass.

### 12.1 Unit tests (pure functions, no DB)
- `addWorkingDays` — a plain N-working-day offset across a weekend; across a known NZ national public holiday; across a year boundary.
- `computeReleaseDate` — each `RetentionTimingUnit` (`working_days`/`calendar_days`/`weeks`/`months`) against a fixed trigger date.
- `endOfMonth` + `addWorkingDays` composed — reproduces the brief's own worked example exactly ("22 working days after the end of the month in which completion occurs").
- `computeRetentionStatus` — every state transition boundary (exactly on an expected date, one day before/after, already released).

### 12.2 Integration tests (real staging data, mirroring this session's existing verification scripts for Retention/DelayEvents)
- **Test 1 (brief)** — $1,000,000 subcontract, 5% retention, 50%/50% split, 12-month DLP: create real `PaymentClaim` rows summing to $1,000,000 claimed, confirm `computeTotalRetentionWithheld` = $50,000, confirm both tranche expected amounts = $25,000, confirm the 12-month-later final date.
- **Test 2 (brief)** — `retentionApplies: false` (or `retentionPercent: null` with `retentionApplies: false` explicitly): confirm the Retention card renders nothing, `computeRetentionStatus` returns `not_configured`.
- **Test 3 (brief)** — run `extractRetentionTermsFromClauses` against the real SA-2017 baseline text itself (already in `lib/standard-forms/sa-2017.json`) as a synthetic "uploaded contract," asserting: `initialReleaseTrigger === "completion_of_subcontract_works"`, `initialReleaseTimingDescription` contains "22 Working Days", `finalReleaseTimingDescription` contains "25 Working Days" and "whichever is later", `clauseReference` cites 12.4/10.4.2(a), `requiresReview === false` (this is the conforming case).
- **Test 4 (brief)** — manually PATCH the same `ContractTerms` fields via the existing route with no extraction having run; assert identical downstream `getRetentionSummary`/status/date-calculation behaviour to Test 1 — proves manual and extracted paths are genuinely equivalent, not two different code paths.
- **Test 5 (brief)** — completion confirmed 1 June; a `PaymentClaim` with `periodEnd` 30 June exists; assert the computed initial-release date uses the confirmed completion date, not the claim's `periodEnd`/`referenceDate`.
- **Test 6 (brief)** — extracted `initialReleaseTrigger: "head_contract_event"`; assert `retentionRequiresReview === true` and the card shows the review banner; assert the system never silently substitutes a head-contract PC date it has no way of actually knowing.
- **Test 7 (brief)** — `initialReleaseTiming: { days: 22, unit: "working_days" }` from a known end-of-month anchor; assert the exact calculated date matches a hand-verified working-day count.
- **Test 8 (brief)** — tranche 1 released; assert tranche 2's default expected date is `tranche1ExpectedDate + defectsLiabilityPeriodDays` exactly (already covered once this session for the V1 build; re-run under the renamed field).
- **Test 9 (brief)** — record `tranche1ReleasedAmount`/`ReleasedAt`; assert `computeNetRetentionCurrentlyHeld` drops by exactly that amount while `computeTotalRetentionWithheld` (the historical gross figure) stays unchanged — this exact behaviour is already built and tested this session; re-confirm it's unaffected by this plan's changes.
- **Test 10 (brief)** — expected date in the past, not released; assert `computeRetentionStatus` returns the correct `*_overdue` state and (deliberately NOT via the live whole-database `runReminderCheck()` — see the standing safety rule established this session) assert the reminder persistence primitive (`prisma.retention.upsert` with a stage transition) behaves correctly in isolation.
- **Test 11 (brief)** — close a `Project` (`lib/project-lifecycle.ts`); assert the `Retention` row and its `RetentionEvidenceLink`s remain fully queryable and unchanged — confirms §10's "already durable" finding holds under the real closure code path, not just by absence-of-evidence.
- **Test 12 (brief)** — extracted `initialReleaseTrigger: "head_contract_event"` (same as Test 6) run through the full Contract Review pipeline end-to-end (not just the isolated extraction call); assert the resulting `ContractTerms.retentionRequiresReview`/`retentionReviewNotes` reach the database via the real `suggestIfUnconfirmed`/upsert path, not just the extraction function's own return value.

### 12.3 Regression
Re-run (or re-verify by inspection, since no live data was changed) the existing Retention verification assertions from earlier this session (16 assertions) and the Delay/EOT verification (21 assertions) — confirms the rename (§11.2) and additive fields don't silently break either.

---

## 13. RISKS / EDGE CASES

- **Bonds in lieu of retention** (SA-2017 clause 3.1.1/3.2.1): a real subcontract may provide a bond instead of retention being withheld at all. `retentionApplies: false` with a note is the correct representation — flagged here so the extraction prompt explicitly considers this case rather than misreading a bond clause as a missing retention clause.
- **Tiered retention rates** ("5% of the first $X, 5% of the next $Y, % of the remainder" — confirmed this exact structure exists in the SA-2017 baseline's own Specific Conditions Schedule fill-in): V1's single `retentionPercent` cannot represent a tiered rate. Recommendation: extract the *first* stated tier as `retentionPercent` (usually the operative rate for most real claim sizes) and capture the full tiered structure verbatim in `retentionClauseReference`/a notes field for human reading, rather than attempting a tiered-rate calculation engine in V1 — explicitly deferred, consistent with §14.
- **`computeTotalRetentionWithheld` currently includes draft claims** (§5) — a real behavioural nuance to fix, not a design flaw, flagged for the implementation pass.
- **Working-day calculation is deliberately incomplete** (§6.3) — regional anniversary-day holidays are not modelled; every date this plan computes must be shown with its own stated basis, never as an unqualified fact.
- **`RecordLifecycleEventType` enum extension is shared infrastructure** — adding `milestone` affects a type used by `variation_item`/`task`/`project` too; confirmed additive-only (new enum value, no existing value changed) so this is safe, but worth the implementer double-checking no other code does an exhaustive switch over that enum that would need a new case (a quick grep before implementing, not assumed here).
- **A confirmed completion date does not, and must not, silently write `Project.completedAt`** — the two remain independent facts (a subbie might confirm subcontract-works-completion for retention purposes before formally closing the project in Subbie HQ for other reasons) unless the implementer deliberately decides otherwise; this plan keeps them decoupled per §17's own instruction not to conflate distinct milestones.

---

## 14. V1 SCOPE VS FUTURE SCOPE

**In scope for this plan (V1):** everything in §3-§12 above — structured single-rate/single-cap retention terms, one completion event, two tranches, working-day-aware (NZ-national-holiday-aware, not regional) date calculation, computed status, reused reminders/evidence/lifecycle/permissions infrastructure, a requires-review flag sourced from a dedicated extraction pass.

**Explicitly deferred**, per the brief's own §14/§15 list, confirmed as genuinely absent from this plan: sectional/staged retention, per-variation retention allocation, tiered-rate calculation (only tier-1 capture, per §13), multi-tier release waterfalls beyond two tranches, trust/bank-account accounting, statutory reporting, automatic legal-validity determination, automatic (un-confirmed) release, a general rule-builder, head-contract retention tracking, and retention forecasting.

**Explicitly kept open for later, by construction, not by accident:** `RetentionReleaseTrigger`/`RetentionTimingUnit` are closed enums today but adding a value to either is additive (§11.5's own precedent); `RetentionEvidenceLink` mirrors `ClaimEvidenceLink` exactly, so any future evidence-kind addition to one is a natural addition to the other; the two-tranche shape does not prevent a future N-tranche model (it would be a genuinely new model at that point, not a retrofit of this one) — noted, not built.

---

## 15. FILE-BY-FILE IMPLEMENTATION PLAN

| File | Change |
|---|---|
| `prisma/schema.prisma` | Rename `Retention.practicalCompletionDateOverride` → `completionOfWorksDateOverride`; add `completionOfWorksConfirmedAt`/`ByUserId`/`Note` to `Retention`; add all §3.2 fields to `ContractTerms`; add `RetentionReleaseTrigger`/`RetentionTimingUnit` enums; add `retention` to `RecordLifecycleEntityType`, `milestone` to `RecordLifecycleEventType`; add new `RetentionEvidenceLink` model + `ClaimEvidenceType`-style `RetentionEvidenceType` enum (or reuse `ClaimEvidenceType` directly if its 5 values suffice — likely yes). |
| `lib/retention.ts` | Update every reference to the renamed field; add `computeRetentionStatus`; filter `computeTotalRetentionWithheld` to non-draft claims (§5); add `confirmCompletionOfWorks(...)` (writes the 3 new fields + logs `RecordLifecycleEvent`); add `linkRetentionEvidence`/`getRetentionEvidence` (mirrors `lib/payment-claim.ts`'s equivalents). |
| `lib/retention-dates.ts` (new) | `addWorkingDays`, `computeReleaseDate`, `endOfMonth`, the small fixed NZ-national-holiday table. |
| `lib/grok.ts` | New `extractRetentionTermsFromClauses` (§4.1), alongside (not replacing) `extractContractTermsFromClauses`. |
| `lib/contract-comparison.ts` | One more `await extractRetentionTermsFromClauses(...)` call alongside the existing terms-extraction call (~line 368); extend the existing `suggestIfUnconfirmed` upsert block (~lines 505-570) with every §3.2 field. |
| `app/api/projects/[projectId]/contract-terms/route.ts` | Add every §3.2 field to `CONFIRMABLE_FIELDS`, `updateContractTermsSchema`, and both `upsert` branches — same mechanical pattern already used for every existing field. |
| `app/api/projects/[projectId]/retention/route.ts` | Add a `POST .../confirm-completion` (or a field on the existing `PATCH`) for §6.1's confirm action; extend the `GET` summary to include computed status (§7.1) and the requires-review flag. |
| `components/settings/contract-terms-section.tsx` | Add §3.2's fields to the existing `FIELDS` config array (trigger fields as a `<select>`, same as any other typed field this form doesn't already support — a small addition to that component's field-type union). |
| `components/payment-claims/retention-card.tsx` | Add the trigger-aware completion-confirmation prompt (§6.1/§9.3), the generated plain-English summary (§9.2), and the requires-review banner (§9.3). |
| `lib/reminders.ts` | No structural change — confirm the existing Retention block's copy matches §7.2's suggested wording; update field name references for the rename (§11.2). |
| `lib/dashboard.ts` | No structural change — confirm the existing `"retention"` dashboard block still resolves correctly against the renamed field. |
| `lib/payment-claim.ts` | No change (pattern is copied, not modified, for `RetentionEvidenceLink`). |
| `lib/record-lifecycle-log.ts` | No code change — just consumed with the new `entityType: "retention"` / `eventType: "milestone"` values from `lib/retention.ts`. |

---

## 16. RECOMMENDED IMPLEMENTATION ORDER

1. **Schema migration** (§11) — the rename + all additive fields/enums/model, staging only, following this session's established `with-staging-db.js` workflow. Smallest-risk step, unblocks everything else.
2. **`lib/retention-dates.ts`** (§6.2/6.3) — pure functions, fully unit-testable in isolation before anything else depends on them (Test Plan §12.1).
3. **`lib/retention.ts` extensions** (§7.1, confirm-completion, evidence links, the draft-claim filter) — built and verified against real staging data next, since everything downstream (UI, reminders) reads through this layer.
4. **`extractRetentionTermsFromClauses`** (§4.1) + its wiring into `lib/contract-comparison.ts` (§4.2) — verified directly against the real SA-2017 baseline text (Test 3/12), the same "run it for real, read the actual output" discipline already used for the Contract Schedule quote-extraction work this session.
5. **API routes** (`contract-terms`, `retention`) — mechanical extensions of already-working routes.
6. **UI** (`contract-terms-section.tsx`, `retention-card.tsx`) — last, since it's the layer with the least remaining design risk once 1-5 are real and verified.
7. **Full regression pass** — re-verify the existing Retention (16 assertions) and Delay/EOT (21 assertions) staging scripts still pass unchanged, confirm `npx tsc --noEmit` clean, before considering this done.

No code has been written for this plan. The next session should begin at step 1.
