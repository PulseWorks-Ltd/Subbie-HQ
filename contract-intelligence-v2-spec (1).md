# Contract Intelligence v2 — Specification

> **Specification frozen.** This document went through five rounds of
> product design review and converged. Only implementation defects should
> change this design from here — further refinement should come from
> watching real pilot users use Phase 1, not from more hypothetical
> discussion. Build Phase 1 next.

## Mission

Contract Review is being redesigned from a clause-comparison tool into the
**Project Operating Manual** for that specific contract. A "survival guide"
is something read once and shelved; an operating manual is something a
subcontractor keeps coming back to throughout the life of the project. Most
subcontractors cannot meaningfully renegotiate a main contractor's
paperwork — they sign what's put in front of them, sometimes with minor
tweaks. The product's job is therefore not primarily to win negotiations.
It is to make sure the subcontractor understands exactly what they've
committed to, what happens if they don't comply, and — most importantly —
how to protect themselves during the project using tools they already have
in Subbie HQ.

Negotiation advice is retained, but demoted to the last thing shown for
each obligation, not the first. Protection is the headline.

This document defines the target data model (the "Obligation" object) and
a three-phase build plan. Nothing in this document should be built in one
pass — each phase is a separate, standalone Claude Code prompt, built and
verified before the next begins.

---

## The core shift

**Current pipeline:**
Contract → Clause extraction → Clause-by-clause comparison → Findings list

**Target pipeline:**
Contract → Clause extraction → Clause-by-clause comparison → **Obligations
("Contract Requirements")** → **Protection Workflow** (the required behaviour,
expressed as a sequenced checklist, each item tied to a Subbie HQ feature)
→ (future) **Live Monitoring**

Note: "Behaviour" was considered as a separate persisted data object during
design review and deliberately rejected — a required behaviour is really
just the description of a single Protection Workflow checklist item, not a
distinct entity in its own right. Introducing it as a fourth object would
add data-model complexity without adding real capability. It's expressed
inline as each workflow step's action text instead.

The existing clause-level extraction and comparison engine is NOT being
replaced — it's strong and stays exactly as-is. What's new is a layer on
top of it that groups the ~130 raw clause findings into a much smaller
number (roughly 15–25) of real-world commercial obligations, and attaches
practical guidance to each one.

---

## The Obligation object (target data model)

Each Obligation should carry:

- **Category** — one of a fixed set of business-outcome categories (see
  below), not a legal category. This is what the user browses by.
- **Title** — plain-English name for the obligation (e.g. "Payment
  Preconditions", "Delay Notice Requirements"), not a clause reference.
  User-facing section label for the group of these is "Contract Requirements"
  rather than "Commercial Obligations" — the internal/technical model
  name can stay "Obligation," but user-facing copy should say "What You
  Must Do."
- **What this contract requires** — plain-English description of the
  actual obligation(s) the subcontractor must satisfy, synthesised from
  potentially many individual clauses.
- **Why this matters / consequence of non-compliance** — what happens if
  the subcontractor doesn't meet this requirement (e.g. payment
  withheld, entitlement lost, claim barred). This must stay grounded in
  what the contract text actually says — no invented dollar figures, no
  speculative consequences beyond what's textually supportable.
- **Commercial impact** — Critical / Important / Informational (see
  severity section below). Note: NO "likelihood" score — likelihood
  depends on how the specific contractor behaves and how the project
  unfolds, which the AI cannot know from reading a static document.
  Scoring it would present a guess as if it were an assessment.
- **Watch out** — a short, memorable line pointing out where this
  obligation is easy to get wrong. This must be framed as a LOGICAL
  inference from the gap between what the clause requires and what
  normal/intuitive practice would be (e.g. "this clause requires notice
  within two working days — waiting until the next site meeting could
  mean the notice period expires before the contractor is informed")
  — never as an empirical claim about what real subcontractors
  statistically do or how often they get caught out. The AI has no
  actual data on other subcontractors' behaviour; presenting a
  fabricated-sounding statistic or generalisation would be the same
  overconfidence problem the Likelihood score was rejected for. See
  Guardrail 4.
- **Protection Workflow** — the PRIMARY content of each obligation,
  replacing "feature mapping." A short sequence of concrete, practical,
  numbered checklist steps the subcontractor can take regardless of
  whether the clause is negotiated away — this is what most users will
  actually act on. Each step in the sequence carries:
  - The action itself, written as something to actually do (e.g.
    "Photograph every signed Day Works sheet")
  - **Frequency** — One-time / Daily / Weekly / Per Variation / Per
    Payment Claim / At Completion / At Practical Completion / During
    Defects Period / Event-driven. This lives on each workflow STEP, not
    on the obligation as a whole, since a single obligation (e.g.
    Payment Preconditions) can bundle both daily actions (QA records)
    and monthly ones (submitting the claim itself).
  - The specific Subbie HQ feature that step maps to (Updates,
    Variations/Site Instructions, Day Works Sheets, Photos,
    Correspondence, Payment Claims once built). This must map to
    features that actually exist and actually do what's being
    described — see Guardrail 1.
- **Can this be negotiated** — demoted to last. Honest framing: if a
  deviation is common/rarely conceded, say so, rather than always
  presenting negotiation as a live option. Kept present (not removed)
  since some pilot users may have more leverage than a typical subbie.
- **Supporting clauses** — every underlying clause-level finding that
  this obligation was derived from, fully preserved and linked. This is
  the traceability layer — see Guardrail 2. Displayed with an explicit
  count up front (e.g. "Derived from 6 related clauses") rather than
  just a plain list — surfacing the count itself reinforces trust, since
  it shows the user why something presented simply actually has
  substantial supporting detail behind it, and invites them to expand
  and check it themselves.

---

## Business-outcome categories (fixed set)

Obligations are grouped by business outcome, not legal topic:

- 💰 Payment & Cash Flow
- 📋 Variations
- ⏰ Notices & Time Bars
- 📅 Programme & Delay
- ⚖️ Liability & Indemnity
- 🛡 Insurance
- 📑 Administration & Documentation
- 🦺 Health & Safety
- © Intellectual Property
- 🧾 Final Account
- ⛔ Termination

(List can be extended if a real contract surfaces an obligation that
doesn't fit — but keep this closed/fixed rather than letting the AI invent
new categories per contract, so the UI and future feature-mapping stays
consistent across every contract review.)

---

## Severity tiers (replaces near-uniform "High Risk")

- **Critical** — directly affects payment, variations, EOT, termination,
  liability, indemnities, time bars, waivers, insurance gaps, IP
  ownership, retention, final account. Expect roughly 5–10 obligations
  to land here on a heavily modified contract.
- **Important** — operational obligations: safety, cleaning, power,
  water, coordination, hoisting, shop drawings, QA, programme
  administration. Expect roughly 10–15.
- **Informational** — minor wording changes, definitions, cross
  references, formatting, procedural differences that don't meaningfully
  change risk.

---

## Presentation hierarchy (three levels)

**Level 1 — Executive summary ("What This Contract Expects From You")**
- Overall assessment (one paragraph, plain English)
- Top obligations by category, with counts (e.g. "6 new payment
  preconditions")
- A short "if you only read one section" pointer toward whichever
  category carries the most Critical obligations

**Level 2 — Contract Requirements (the main experience)**
- Grouped by business-outcome category, collapsible
- Each obligation shown as its own card per the Obligation object above,
  with its Protection Workflow rendered as a checkable checklist (not a
  paragraph) — each step shows its action, Frequency, and which Subbie HQ
  feature it maps to
- This is what most users read in full

**Level 3 — Supporting clause analysis (unchanged, pushed deeper)**
- The existing clause-by-clause comparison, exactly as it works today
- Reached by expanding "Supporting clauses" on any obligation, or via a
  separate "View full clause analysis" link
- This is what makes the tool checkable/verifiable — not deleted or
  reduced, just no longer the first thing shown

---

## Terminology changes

| Old | New |
|---|---|
| Major Deviation | New Obligation |
| Added Clause | Additional Requirement |
| Major Risk / High Risk | Commercial Impact: Critical |
| Recommendation | What you should do |
| Commercial Obligations (section heading) | Contract Requirements |
| Feature Mapping | Protection Workflow |
| Common Mistake | Watch Out |

---

## Guardrails (non-negotiable, apply to every phase)

1. **Feature-mapping accuracy is a correctness requirement, not
   polish.** If an obligation says "protect yourself using Day Works"
   when Day Works isn't actually the right tool for that obligation,
   that's a wrong answer with real financial consequences for the
   person relying on it — not a rough edge to fix later. Before this
   reaches pilot users, Shaun should personally sanity-check the
   obligation-to-feature mapping against several real contracts, the
   same way contract review itself was tested before being trusted.

2. **Traceability is mandatory.** Every obligation must remain visibly
   linked to the specific clauses it was derived from. Nothing should
   ever be presented as a summary without a path back to the source
   text a user (or their lawyer, or a dispute) could check against.

3. **No promising functionality that doesn't exist yet.** Phase 1 and
   Phase 2 must not use UI language implying live automation (e.g.
   "click here to configure reminders") — that's Phase 3. Use guidance
   language instead (e.g. "we recommend logging this in Updates").
   Overpromising here would undermine the exact trust this feature is
   meant to build.

4. **No invented figures or invented behavioural claims.** No specific
   dollar amounts unless the AI can genuinely substantiate them from the
   contract text. Use relative indicators (e.g. impact level) rather than
   fabricated numbers. This extends to the "Common mistake" field: it must
   be framed as a logical inference from the clause itself (what the
   clause requires vs. what normal practice would intuitively be), never
   as a claim about what subcontractors statistically or commonly do —
   the AI has no actual data on real subcontractor behaviour, and
   presenting a guess as a generalisation is the same overconfidence
   problem that ruled out scoring "Likelihood."

5. **The "not legal advice" disclaimer stays prominent**, specifically
   next to consequence statements ("what happens if you don't comply"),
   not just buried in a footer — this content is what pilot users are
   most likely to act on directly, given most can't negotiate it away.

6. **Cost is tracked, not assumed.** Obligation clustering (Phase 2) is
   real additional AI reasoning per contract, expected to raise cost
   from ~$1.50 to an estimated $3–4/review. This is an acceptable
   trade given contract review is low-frequency and high-stakes, but
   the real number should be confirmed via the AI usage dashboard once
   built, before finalising pricing-tier allowances.

---

## Phased build plan

### Phase 1 — Commercial Understanding (presentation redesign only)
No new AI reasoning. Restructure how existing clause-level findings are
displayed:
- New executive summary page ("What This Contract Expects From You")
- Severity tiers (Critical / Important / Informational) replacing
  near-uniform High Risk
- Business-outcome category grouping
- Terminology changes per the table above
- Existing clause-level findings become Level 3, reachable by drilling in

### Phase 1.5 — Grounded Summary & Positive Findings
Status: SHIPPED, verified.

### Phase 1.75 — Category Intelligence (new AI reasoning layer, smaller than
Phase 2)
This sits between the executive summary and individual clause findings —
a mid-tier "what does this section actually mean for my business" summary
per category, replacing the current bare category header + flat list of
findings.

For each category with findings, the AI generates:
- **What This Means** — a short (2-4 paragraph) synthesis of what the
  changes in this category actually mean commercially, written at the
  category level (e.g. "this contract substantially strengthens the
  Contractor's control over payments")
- **Key Risks** — a short bullet list of the category's main risks,
  synthesized across its findings, not a restatement of every individual
  finding
- **How to Protect Yourself** — a short bullet list of practical
  compliance actions at the category level, referencing relevant Subbie
  HQ tools where appropriate (Variations, Day Works, Updates, Photos)
- Individual clause-level findings (with their own "what you should do"
  text from Phase 1/1.5's operational-language work) remain underneath,
  collapsed by default, as the supporting evidence — unchanged from
  today, just pushed one level deeper

GUARDRAILS SPECIFIC TO THIS PHASE:
- No live/real-time status language (e.g. 🟢/🟠/🔴 "you are currently
  compliant" indicators). That implies active monitoring against real
  project data, which doesn't exist until Phase 3. This phase is
  descriptive ("here's what changed and what to do"), not a status
  dashboard. Using status language here would overpromise functionality
  that isn't built yet — the same overpromising trap flagged earlier in
  this whole design process.
- Genuine synthesis required, not restatement. The category-level "Key
  Risks" and "How to Protect Yourself" bullets must be a smaller number
  of higher-level points that summarise the pattern across findings —
  not a paraphrased list of the same recommendations already sitting on
  each individual finding underneath. If the category summary just
  repeats the individual findings in different words, it's wasted
  reasoning and a confusing read (two near-duplicate lists at two levels
  of the same page). The individual clause-level "what you should do"
  text should stay more specific/tactical than the category-level bullets.
- This works entirely within the existing fixed category set (12
  categories including Site Facilities & Operations) — no emergent
  grouping, no AI-determined clustering. That's what distinguishes this
  from Phase 2 and keeps it lower-risk: the categories are already fixed
  and known, this phase only adds a synthesis layer on top of findings
  already correctly categorised.

### Phase 2 — Obligation Intelligence (new AI reasoning layer)
- AI clusters the ~130 clause-level findings into ~15–25 Obligations
  ("Contract Requirements") per the object model above
- Each obligation gets its Protection Workflow generated: a sequenced,
  numbered checklist, each step carrying a Frequency and a mapped Subbie
  HQ feature
- Each obligation gets a "Common mistake" line, framed per Guardrail 4
  (logical inference from the clause, not an empirical claim)
- Full clause-level detail preserved underneath every obligation for
  traceability
- This is where real cost increase happens — confirm actual cost via
  the AI usage dashboard before/after building this

### Phase 3 — Contract Coach (live monitoring, future/separate effort)
- Structured obligations (trigger condition, deadline, consequence) power
  live warnings during the actual project — e.g. an SI sitting unconverted
  near a notice deadline triggers a warning
- Comparable in scope to Payment Claims itself — this is a distinct,
  substantial feature, not a natural extension to bundle into Phase 1/2
- Belongs on the roadmap after Payment Claims and Phase 1/2 are both
  solid and proven with real pilot usage, not before

---

## Next step

Phase 1 is ready to become a Claude Code build prompt — it requires no new
AI reasoning, just restructuring existing data, and is the fastest way to
fix the "wall of red" trust problem in the current review. Phase 2 should
wait until Phase 1 has been used by real pilot users and its cost/value
confirmed before committing AI reasoning budget to obligation clustering.
