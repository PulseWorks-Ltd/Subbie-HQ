# Subbie HQ — Full Outstanding Roadmap (as of this session)

Status key: ✅ Built & confirmed working · 🔶 Prompt drafted, not yet
confirmed built/run · 📋 Documented as future direction only, not
scheduled

---

## 1. The app's own namesake feature — Payment Claims

**Superseded by the `record-lifecycle-and-filing` initiative — re-verified
directly against the codebase, this section was stale.** The backend
described below as "not built" now genuinely exists:

- ✅ `PaymentClaim` extended with `claimMonth`, `allocations`
  (`VariationItemClaimAllocation` — real per-month Variation allocations
  against the live `VariationItem`) and `claimEvidenceLinks`
  (`ClaimEvidenceLink` — a real polymorphic link into the actual live
  evidence chain: VariationPackage/Correspondence/ExternalAction/
  QARecord, deliberately not the old orphaned `Evidence*` models).
- ✅ `lib/payment-claim.ts` — real, non-stub business logic
  (`recomputeClaimTotal`, `setVariationAllocation`,
  `linkClaimEvidence`/`unlinkClaimEvidence`, `getClaimEvidence`).
- ✅ The wider lifecycle layer this shipped alongside also exists in full:
  `VariationItem`/`Project`/`Task` close-and-reactivate state
  (`closedAt`/`reactivatedAt`/`completedAt`), a shared
  `RecordLifecycleEvent` audit log, `components/lifecycle/closure-review-
  dialog.tsx`, and a real `Task` model with its own UI (`app/(app)/
  projects/[projectId]/tasks`).
- 📋 **What's still actually missing is the UI only**: `app/(app)/
  projects/[projectId]/payment-claims/page.tsx` still renders
  `PlaceholderSection` — none of the real backend above is wired to a
  page yet. Two more lib files shipped with no UI consumer at all yet
  either: `lib/archive-queries.ts` (Year → Month → Record Type drill-down
  — no `/archive` route exists) and `lib/global-search.ts`
  (`searchProjectHistory` — not called from anywhere in `app/` or
  `components/`).

Net effect: this is now a **UI-only build**, not a schema-and-logic
build — the highest-leverage remaining item in this whole file, because
the expensive part (data model + business rules + evidence linking) is
already done and verified, only the pages that call it are missing.
Zero CCA s.20 deadline-tracking still exists anywhere (that part of the
original plan was schema/UI, not lib — still genuinely open).

✅ **Update, same session: the Payment Claims UI gap above is now closed**,
via a new **Contract Schedule of Values** feature (`lib/contract-schedule.ts`,
new `ContractSchedule`/`ContractItem`/`ContractItemComponent`/
`ContractItemComponentPhase`/`ContractItemProgressEntry` models, a new
`/projects/[projectId]/contract-schedule` page, and a real Payment Claims
list + detail page replacing the placeholder). This is the "Original
Subcontract Sum" side of a claim (Appendix B2's equivalent) — extracted
from a subbie's own priced quote (manual entry only so far; AI extraction
from an uploaded quote is a deliberately separate, not-yet-built follow-up
phase). Key mechanism: one dated %-checkpoint history per fixed-component
phase (Supply/Install/Erect/Dismantle/etc., point-in-time read) and per
weekly-hire component (day-weighted read across a claim period, correctly
handling a % that changes mid-period — the one thing the subbie's own
Excel payment-claim template flagged as unsolved in its own header text).
Verified against 10 real assertions, including the exact real dollar
figures from `docs/Standard Documents/Cintra Apartments - Scaffold Quote
(27.01).pdf`'s own "Stage A" line ($12,600 Erect & Dismantle + $750
Transport + $504/wk hire = $13,854, matching the quote's own printed
total) and a from-scratch reproduction of a user-supplied worked example
for rental proration across a facade-by-facade handover. Payment Claims'
existing `generate/route.ts` (the orphaned legacy path described above)
was deliberately left untouched rather than repurposed — a new route in
the same file handles real claim creation instead. ✅ **Phase 2, same session: AI-driven quote extraction, now built.**
`extractContractScheduleFromImages` (`lib/grok.ts`) reads an uploaded
quote via Grok vision (never plain text — confirmed the real quote's
multi-column table gets reordered badly by pdftotext-style extraction)
and returns a full draft schedule: every line, its components (Supply/
Install/Erect & Dismantle/Transport/Weekly Hire/etc.), any per-line or
global phase split, and a deterministic self-verification against the
quote's own printed grand total (never trusting the model's arithmetic —
same principle as the Day Works crew-size cross-check). New `/extract`
and `/confirm-extraction` routes and an `ExtractQuoteDialog` review screen
on the Contract Schedule page — nothing is saved until a human reviews
and confirms it. **Real run against the actual Cintra Apartments quote**:
28 items extracted, the global "70% Erect / 30% Dismantle" note correctly
read, and the quote's own printed grand total ($344,911.20) matched
exactly, with the independently-reconstructed line-item total landing
within 0.04% of it. One real bug found and fixed during this verification:
the extraction schema required every optional field present-with-null,
but Grok frequently omits a not-applicable key entirely rather than
setting it to JSON null — switched to Zod's `.nullish()` throughout.

✅ **Phase 3, same session: Project Diary → contract-item % complete,
now built.** A new "+ Progress" action on any Project Diary entry (desktop
`update-thread.tsx`, mobile `mobile-thread.tsx`, and the Variation's own
Linked Diary Entries section — all three real UpdateThread render sites)
opens a small dialog: pick a contract item, then which of its components/
phases the entry reports on, a % and an effective date (defaulting to the
diary entry's own date), and it's recorded as a `ContractItemProgressEntry`
with `source: project_diary` linked back to that Update — reusing the
Phase 1 `/contract-schedule/progress` route rather than a new one.
Deliberately NOT folded into the existing SI/Variation/QA tag `<select>`:
those three are mutually-exclusive facets of "what this update is about,"
while contract item progress is an independent, addable fact about it.
One real permissions decision made here: recording progress from a diary
entry is gated by **Updates** access, not Payment Claims access (a site
foreman posting a diary entry has no reason to hold Payment Claims
permission) — direct manual entry on the Contract Schedule page itself is
unchanged, still gated by Payment Claims access. Verified with 10 real
staging assertions, including that a diary-entry-sourced checkpoint flows
into the Payment Claim calculation identically to a manually-entered one
(same table, same read logic, no special-casing by source).

All three phases of the Contract Schedule of Values feature are now
built: schema + calculation engine + Payment Claims wiring (Phase 1),
Grok vision quote extraction (Phase 2), Project Diary progress assignment
(Phase 3).

---

## 2. Contract Review — Phase 2 & 3

**Phase 1 / 1.5 / 1.75 — ✅ built, live, verified**, including the
severity-direction reliability fix, map-phase deduplication, category
fix, and operational-language rewrite.

🔶 **Phase 2 (Obligation Intelligence)** — clustering ~130 clause findings
into ~15-25 real commercial obligations, each with a Protection Workflow
checklist, Frequency per step, "Watch Out" line. **A fully-scoped build
prompt exists and is ready to run**
(`claude-code-prompt-contract-review-phase2-obligations.md`) — explicitly
held back pending real pilot usage of Phase 1/1.75, per the frozen spec's
own sequencing logic (confirm cost/value before committing further AI
reasoning budget).

📋 **Phase 3 (Contract Guardian)** — live monitoring: structured
obligations powering real-time warnings (e.g. an SI approaching a notice
deadline). Long-term direction only, gated behind Phase 2 existing and
being validated. NZ/SA-2017 scope only — explicitly not to be built for
any other contract form (NZS3910/3916 are head contracts, not
subcontracts; NZS3915 is the real candidate if another NZ baseline is
ever wanted) or jurisdiction until real demand exists.

---

## 3. Commercial/Resource Control (new pillar, just documented)

📋 **Long-term direction only, not scheduled.** Cost-vs-entitlement
tracking — staff, time allocation, vehicles/assets, job costing — framed
specifically around "you've incurred cost, have you captured the
entitlement," not generic workforce/fleet management (explicit boundary
list excludes payroll, leave, rostering, GPS fleet tracking, full
accounting). Fully documented in `subbie-hq-product-vision.md`.

---

## 4. Site Pro App replacement track — status per item

✅ **Project Diary** (renamed from Updates, unified single-dropdown Type/
Related-To picker, search/filter by category, decluttered "Use as Day
Works Sheet" into an overflow menu) — confirmed built and working.

✅ **External Action framework** (Acknowledge/Sign/Confirm/Reject/Comment,
secure no-login response links) — built, then the context-fix (drafted
message + real cumulative value instead of showing the recipient their
own instruction back) confirmed built and committed.

✅ **Request Approval on Variation Packages** — discovered mid-build that
this didn't actually exist yet despite an earlier prompt assuming it did;
built properly, verified with real assertions, committed.

✅ **Automatic Variation Package scheduling** — three-tier (Manual/
Automatic with Approval/Fully Automatic), Contract Terms scheduling
fields (fixed date or working-days-before-month-end, both suggest-then-
confirm extracted), recipient list with To/Cc roles, 2-working-day
warning window verified to fire *before* the real deadline, cancellation
verified to genuinely block the scheduled send. **Built, verified with 34
real staging assertions, pushed to `main`.**
⚠️ **Not yet personally tested end-to-end by the app owner** — recommended
before trusting this on any real project, given it's the first fully-
autonomous external-send feature in the app.

🔶 **H&S document categorisation + new QA module** — prompt drafted
(`claude-code-prompt-hs-categories-and-qa-module.md`: SSSP/Hazard
Register/Toolbox Talk/Induction/Incident Report categories; new QA
records assignable to a project or a specific SI/Variation; "Use as QA
Record" mirroring the Day Works pattern; QA as a real Incoming Emails
filing destination) — **not yet confirmed built or run.**

🔶 **"Labour, Materials & Plant" manual-entry parity for Labour** — prompt
drafted (`claude-code-prompt-labour-manual-entry-parity.md`) to give
Labour the same independent, no-file-required inline manual-add form
Materials/Plant already have — **not yet confirmed built or run.**

📋 **"My Actions" dashboard** — cross-object aggregator (overdue SI
responses, pending External Actions, upcoming QA, etc.). Deliberately
sequenced *after* External Action, since it now has real pending/
responded state to aggregate from. Not started — natural next candidate
in this track given External Action is proven.

📋 **Compliance register expansion** — broadening Insurance into a wider
Compliance concept (Certifications, People competencies like Site Safe/
First Aid, Plant/Equipment WOF/Test&Tag, Company licences). Each category
needs its own real extraction pipeline, not a relabel — not started.

📋 **Forms** — staged approach agreed (fixed templates → user-configurable
labels → AI PDF-import mapping), deliberately not an open-ended form
builder. Not started.

📋 **Navigation reorganisation** (Comply/Control/Commercial/
Communications groupings) — explicitly sequenced last, only once the
underlying features in each bucket are real.

📋 **QR codes** — explicitly low priority, "useful for a later date."

📋 **True digital/e-signatures** — External Action's "Sign" type already
gives a lightweight recorded-acknowledgement version. A genuine certified
e-signature service is separate future work, and the honesty guardrail
(never describe the current version as "legally binding") must carry
forward if this is ever built out further.

---

## 5. Marketing site — remaining content

🔶 **7 remaining industry pages** (Electricians, Plumbers, HVAC, Civil,
Roofing, Concrete, Interior Fitout Contractors) — the commercial-story
template (Hero/Reality/Where You Lose Money/What The Contract Requires/
How Subbie HQ Helps/Site Event→Evidence/Why This Matters/CTA) is proven
across 4 live pages (Scaffolding, Painting, Masonry, Residential
Builders) — each remaining trade needs the same grounded-research
treatment before drafting, not a template reskin.

📋 **2 remaining comparison pages** (vs Generic Construction Software, vs
Project Management Software).

🔶 **2 guide/SEO pages exist as draft-only, correctly de-indexed and
unlinked** (Payment Claims Under the CCA, Site Instruction vs Variation)
— structure built, real content and legal-accuracy pass still needed
before publishing.

📋 **12+ further problem/SEO pages** from the four-group taxonomy
(Getting Paid / Managing the Job / Understanding Contracts / Running a
Subcontracting Business) — explicitly NOT to be batch-generated; several
are jurisdiction-sensitive (Payment Claims, Retentions, Set-off, Time
Bars, Adjudication vary between NZ and each Australian state) and need
individual legal-accuracy care.

📋 **Resource Centre** — long-term target of 100+ interlinked articles,
deliberately slow-paced, a handful at a time.

⚠️ **Analytics/Search Console core-pages prompt** — drafted
(`claude-code-prompt-analytics-and-core-pages.md`: GA4/Clarity tracking,
About/Contact pages) — Search Console itself is confirmed live and
working (real sitemap submitted and indexed), but it's unclear whether
the GA4 tracking and About/Contact page portions of that prompt were
ever actually run. Worth checking directly.

---

## 6. Smaller known gaps from the full application audit

Already fixed in the pre-pilot batch: ✅ Insurance "Send to all active
projects" misleading copy, ✅ login rate limiting, ✅ Payment Claims
messaging (in-app + homepage + pricing tier copy).

Still open, none currently blocking, roughly ordered by real-world
relevance:

- 📋 **Billing access-status enforcement is UI-only** — a past_due/
  cancelled organisation still has full working API access; the lock only
  hides page content. Needs fixing before real paid billing goes live
  (not urgent under a free pilot-code cohort).
- 📋 **My Settings password change doesn't invalidate other sessions** —
  only the forgot-password flow does; a real inconsistency between two
  paths that should behave the same.
- 📋 **No email verification at signup.**
- 📋 **Correspondence can't display `external_update` row content** — the
  real body text exists in the database but has no "View" affordance in
  that specific row type; also its source icon is hardcoded to a mail
  icon regardless of actual source.
- 📋 **Scope has no AI-parsing** — 100% manual entry today, despite
  `confidence`/`status` schema fields that look designed for extraction
  (unlike Programme, which has real AI parsing). A genuine, not-yet-built
  capability gap, not a documented deferral.
- 📋 **`ScopeProgrammeLink` is write-only from the API** — the join table
  and its route exist, nothing in the UI ever calls it.
- 📋 **Sentry DSN is hardcoded and identical across dev/staging/
  production** — no environment tag distinguishing which environment an
  error actually came from.
- 📋 **Legacy `Variation`/`MonthlyWorkRecord` models** — orphaned, zero
  real UI writers, still referenced by the (currently unreachable)
  Payment Claims generate route. Should be retired once Payment Claims is
  properly rebuilt, not before (still needed as historical reference
  until then).
- 📋 **Main Contractor detail view** has a documented TODO to surface that
  contractor's Contract Review comparison history there — not built.
- 📋 Minor stale-comment cleanup (`lib/s3.ts`, `lib/day-works-rates.ts`)
  and a `.env.staging.example` Stripe price-ID variable naming mismatch —
  cosmetic/documentation-only, no functional impact.

---

## 7. Known, deliberately-accepted limitations (not bugs, not forgotten)

- **Public holiday calendars are not modelled anywhere** — both Day
  Works penalty-rate detection and the new Variation Package scheduling
  only recognise weekends as non-working days. `Organisation.jurisdiction`
  exists as pure data capture specifically to make this fixable later,
  but nothing currently reads it for this purpose.
- **Quote extraction has no comparison logic yet** — a quote can be
  flagged and extracted (value, line items, scope) but nothing compares
  it against anything. Explicit groundwork for a future Payment Claims
  feature.
- **DOCX attachments have no inline preview** — download-only, by design.
- **The invite-flow name field** is a single free-text field, inconsistent
  with the rest of the app's dedicated firstName/lastName fields —
  documented in code as a deliberate, acknowledged choice.
- **Incoming Emails**: only Variation/SI has a real structured-extraction
  destination; every other category is tagged/filed, not parsed into a
  model (QA becoming a second real destination is 🔶 drafted above).
- **`variationValue` (manual) and Day Works computed totals** are two
  independent numbers on the same item, nothing keeps them in sync — by
  design, worth knowing.

---

## Suggested next real steps, in rough order of leverage

1. **Personally test the Automatic Variation Package scheduling** end to
   end on a real project before trusting it further.
2. **Confirm/run the two unconfirmed 🔶 prompts** (H&S+QA module, Labour
   manual-entry parity) — both drafted, neither confirmed executed.
3. **Get real pilot users onto what's live** — this is still the actual
   gate on Phase 2, and increasingly on several other "wait and see"
   decisions stacking up across this roadmap.
4. **Payment Claims UI** — see the corrected §1 above: the backend is
   already built and verified; only the page (and Archive/Global Search's
   pages, same situation) remain. Now the single highest-leverage item in
   this file precisely because the expensive part is already done.

---

## 8. Reconciled against the "Where SubcontractorOS Is Ahead" competitive
   doc (separate document, same session)

That doc's 7 areas assessed against this codebase directly (not just
against its own text, which pre-dates some of this session's work):

- **Area 01 (messaging)** and **Area 04 (no-app messaging)** — largely
  ✅ already shipped: the live homepage hero is already outcome/leakage-
  framed ("The Work Gets Done. The Money Doesn't Always Follow" / "money
  quietly left on the table") and already states the secure-link, no-app
  approval flow above the fold; `features/approvals-automation` exists as
  a dedicated page. Genuinely still open from that doc: the Leakage
  Calculator (not built), reframing the guides index as "leak points" (not
  done), and a public/self-serve Contract Review teaser tool (not built).
- **Area 02 (Delay/EOT) and Area 03 (Retention)** — confirmed genuinely
  **not built**: no `Retention` or `DelayEvent` model exists anywhere in
  `prisma/schema.prisma`. Both docs agree here; this is real, unclaimed
  work.
- **Area 05 (founder/social proof) and Area 06 (sales process)** — no
  About/Founder page, no testimonials anywhere in the marketing routes,
  confirmed absent. Pure content/process work, nothing to build.
- **Area 07 (unified commercial view)** — the competitive doc assumed this
  was blocked on Retention/EOT existing first. Half-true: the *aggregation
  layer* (Dashboard feed, a Commercial Position snapshot) does need those
  two models. But **Claims itself — the other half of "unified" — is not
  blocked on anything anymore**, per §1's correction above: its schema and
  evidence-linking logic already exist, only its page doesn't.
