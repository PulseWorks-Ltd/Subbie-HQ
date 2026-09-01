# Subbie HQ — Full Outstanding Roadmap (as of this session)

Status key: ✅ Built & confirmed working · 🔶 Prompt drafted, not yet
confirmed built/run · 📋 Documented as future direction only, not
scheduled

---

## 1. The app's own namesake feature — Payment Claims

📋 **Not built.** Confirmed via the full app audit: the page renders a
placeholder ("coming in the next build phase"). A backend exists but is
structurally disconnected — its generate route sums two orphaned legacy
models (`Variation`, `MonthlyWorkRecord`) that nothing in the current
UI writes to; running it today would produce a total near $0. Zero
CCA s.20 deadline-tracking exists anywhere.

**A complete, previously-designed implementation plan already exists**
(schema, routes, UI, deadline logic, reminders) — this is an unstarted
build, not an unsolved design problem. Sequencing note: automation for
Payment Claims (auto-scheduling/sending, mirroring what was just built
for Variation Packages) is explicitly deferred until Payment Claims
itself is real.

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
4. **Payment Claims** — the biggest single gap between what the product
   is named and what it currently does; a real design plan already
   exists, ready to execute when prioritised.
