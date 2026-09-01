# Subbie HQ Product Vision

## The AI Contracts Manager for Every Subcontractor

### Vision Statement

Subbie HQ exists to give every subcontractor the guidance, protection and
commercial oversight of an experienced Contracts Manager — without the
cost of employing one.

Most subcontractors cannot justify employing a full-time Contracts Manager
or engaging lawyers to review every contract, assess every variation,
monitor every contractual obligation, or prepare every payment claim. As a
result, many unknowingly accept unnecessary commercial risk, miss
contractual deadlines, lose entitlement to variations, or experience
payment disputes that could have been avoided.

Subbie HQ changes that.

Rather than simply storing project information or reviewing contracts,
Subbie HQ continuously helps subcontractors understand, manage and comply
with the contractual obligations that directly affect their ability to
complete projects successfully and get paid.

The goal is not to replace legal advice. The goal is to replace the
day-to-day commercial guidance that an experienced Contracts Manager
provides throughout the life of a project.

### The Problem We Solve

Most subcontractors are experts in their trade. They are not experts in:

- Contract administration
- Contract interpretation
- Payment claim preparation
- Variation management
- Delay notices
- Evidence collection
- Commercial risk management

Large contractors employ Contracts Managers to perform these functions.
Most subcontractors cannot. This creates an uneven playing field where
commercial outcomes are often determined not by the quality of the work
performed, but by who understands the contract best. Subbie HQ exists to
level that playing field.

### Our Role

Subbie HQ is not simply an AI contract reviewer. It is an AI Contracts
Manager. That means it continuously asks the same questions an
experienced Contracts Manager would ask throughout a project:

- Have we protected our entitlement?
- Have we complied with the contract?
- Have we submitted the required notices?
- Can we prove this variation?
- Do we have enough evidence?
- Are we approaching a contractual deadline?
- Is this payment claim complete?
- What commercial risks exist right now?
- What should we do next?

Every feature within Subbie HQ should ultimately help answer one or more
of these questions.

### Product Philosophy

Every feature should move beyond simply presenting information. Instead,
every feature should answer three questions:

**1. What does the contract require?** Not legal wording — plain English.
What is actually expected of the subcontractor?

**2. Why does it matter?** What commercial consequence exists — delayed
payment, rejected variation, loss of entitlement, additional liability,
liquidated damages, increased costs, reduced profit? The emphasis is on
commercial impact rather than legal interpretation.

**3. What should I do?** This is where Subbie HQ differentiates itself.
Rather than stopping at explaining risk, the system should provide
practical operational guidance — e.g. submit a delay notice within two
working days, obtain written approval before commencing variation work,
keep signed Dayworks Sheets for all additional labour, attach QA
documentation to this Payment Claim, record this Site Instruction
immediately. Every recommendation should direct the subcontractor towards
protecting their commercial position.

### From Contract Review to Project Operating Manual

Traditional AI contract review answers: what changed? Subbie HQ should
answer: how do I successfully operate under this contract?

The contract review should become the project's operating manual. Instead
of overwhelming users with clause-by-clause differences, it should
organise information around the practical obligations that determine
project success. For each commercial obligation, the review should
explain: what the contract requires, why it matters, what happens if it
is ignored, how to protect yourself, and which Subbie HQ tools help you
comply.

### Every Feature Supports Contract Compliance

The contract review should not exist in isolation — it should drive the
rest of the application:

- **Payment Claims** — ensure every contractual payment precondition has
  been satisfied before submission, not just generate a claim.
- **Variations** — help preserve entitlement by ensuring instructions,
  pricing, evidence and approvals satisfy the contract, not just record
  the variation.
- **Site Instructions** — identify instructions likely to create
  additional cost or delay and recommend the appropriate contractual
  response, not just log the instruction.
- **Updates** — capture contemporaneous evidence required to support
  future contractual claims, not just act as a project diary.
- **Dayworks** — produce evidence necessary to substantiate variation
  entitlement under the contract, not just record labour.
- **Documents** — organise contractual evidence that may later be
  required to support payment, extension of time or dispute resolution,
  not just store files.

### AI Behaviour

The AI should think like an experienced Contracts Manager. Whenever new
information is received, it should ask: does this affect payment? Does
this affect programme? Does this create a variation? Does this require
notice? Is evidence required? Is there a contractual deadline? Is there
anything the subcontractor should do now? The AI should be proactive
rather than reactive.

### Long-Term Vision — Three Stages

**Stage 1 — Understand.** Analyse the contract and explain the commercial
obligations.

**Stage 2 — Guide.** Connect contractual obligations to everyday project
activities, recommending the correct actions and evidence as work
progresses.

**Stage 3 — Protect.** Continuously monitor project events, identify
commercial risks before they become disputes, remind subcontractors of
contractual obligations, and help preserve entitlement throughout the
project lifecycle. At this stage, Subbie HQ becomes an active commercial
partner rather than a passive software tool.

This three-stage arc applies at the company level, not just to Contract
Review — it's the same Understand → Guide → Protect progression that
Contract Review's own Phase 1 → Phase 2 → Phase 3 roadmap already
follows, generalised to every feature.

### The Test for Every Feature

If an experienced Contracts Manager was sitting beside this subcontractor
today, what advice would they give right now, and can Subbie HQ provide
that same guidance? If the answer is yes, the feature aligns with the
product vision. If not, it should be reconsidered or redesigned.

### Product Positioning

Subbie HQ is the AI Contracts Manager for subcontractors. It helps
subcontractors understand their contracts, comply with their obligations,
protect their commercial entitlements, maximise payment, minimise
disputes, and confidently manage projects — providing the commercial
expertise of an experienced Contracts Manager at a cost that every
subcontracting business can afford.

---

## Roadmap Notes — Future Direction (not yet built, not next-in-line)

These ideas came out of a product discussion following this vision
document and are captured here for future reference. None of these are
scheduled ahead of Payment Claims. They're recorded here so the reasoning
behind sequencing isn't lost.

### Quoting module (new, unscoped)
A genuinely new module — nothing in the app today generates or manages
quotes. Worth a dedicated scoping conversation when the team is ready
(what a quote needs to contain, whether/how it flows into the eventual
signed contract, whether final terms get compared back against the
original quote). Not scoped further here.

### Delay notifications and live contract monitoring ("Contract Compliance
Engine" / Contract Guardian)
This is Contract Review Phase 3 — the fullest version of this idea is now
documented in `contract-intelligence-v2-spec.md` under Phase 3, including
a generic Contract Event Engine architecture (classify any incoming
document, match against structured contract obligations, generate
required actions with deadlines and evidence requirements), lifecycle
states per contract event, a live dashboard, and a "Contract Rights
Score." It cannot be built ahead of Phase 2 — the structured obligation
data Phase 2 would produce is what a trigger/deadline is computed from.
Phase 2 itself is currently on hold, explicitly, pending real pilot usage
of Phase 1/1.75 (see spec for the full reasoning). This is a genuine
confirmation that Phase 2/3 matter and belong on the roadmap — not a
reason to skip ahead of their prerequisites.

### Contract data extraction feeding the rest of the app
The broader idea — extracting programme, scope, notice periods, EOT
protocols, insurance requirements, day works rates, markup percentages
from a contract and using that data elsewhere in the app (e.g. against
SIs to determine notice deadlines for additional costs) — is the same
Phase 2/3 dependency as delay notifications above, generalised further.
Two things already exist and are worth checking before building anything
new to avoid duplication:
- Insurance requirement extraction and cross-checking against held
  certificates is already built (the Insurance module).
- A "terms extraction" AI call already runs as part of the existing
  19-call Contract Review pipeline — audit what it currently captures
  (it may already extract some of day-works-rate/markup-percentage data)
  before building a parallel extraction step.

### Commercial/Resource Control — cost-vs-entitlement (long-term pillar, not scheduled)

**Status: long-term direction only, captured here so it isn't lost. Not
scheduled ahead of Payment Claims or Contract Review Phase 2/3 — same
"wait for real pilot signal" discipline as everything else in this
document.**

**The core reframe, and why this is different from generic workforce
software:** the temptation is to describe this as "add staff/vehicle
management." That's the wrong frame, and would be genuine scope creep
into an already crowded, well-funded NZ-native category (Tradify,
Fergus, ServiceM8, NextMinute, AroFlo, simPRO all already do rostering/
dispatch/timesheets well). The right frame: Subbie HQ currently answers
"what are we entitled to?" (contract value, approved variations, day
works claimed). This pillar adds the other half of the same equation —
"what did it actually cost us?" — and connects the two. The product
already computes revenue-side numbers; this adds real cost-side numbers
and asks the question that makes both sides meaningful together:

> **"You've incurred cost. Have you captured the entitlement?"**

That question — e.g. "SI-241 has incurred approximately $1,420 of actual
cost but no corresponding variation value has been recorded" — is a
direct, sharper expression of the product's existing core thesis, not a
new one bolted on.

**Hard boundary — what this explicitly does NOT become:**
- ❌ Payroll, leave management, performance reviews, onboarding,
  recruitment, full HR records
- ❌ Complex rostering/dispatch boards
- ❌ Fleet servicing management, fuel-card management, GPS fleet tracking
- ❌ Full accounting, full inventory management

There are excellent, mature, well-funded NZ-native products for all of
the above. Building any of them would mean competing head-on with
entrenched incumbents on their home ground, not filling a gap — the
opposite of Subbie HQ's actual competitive position (genuine white space
in AI-powered subcontractor-side commercial/contract protection).

**What this DOES mean, kept deliberately minimal:**
- **Staff** — name, role, cost rate, charge-out rate. Not a full HR
  record.
- **Time allocation** — a lightweight "Start Work → pick project → pick
  activity type (Contract Works/Variation/Day Works/Site Instruction/
  Rework/Travel/Waiting/Defect/Other) → Stop" flow, ideally near-zero-
  admin from a worker's phone. No GPS tracking required — project +
  worker + time + activity type is enough; location validation only if a
  customer specifically wants it later.
- **Vehicles/Assets** — registration, type, internal cost/hour or cost/
  km, assigned driver, current project, WOF/rego/insurance expiry
  (reusing the existing compliance-reminder pattern already built for
  Insurance/H&S). Allocated to a project/date/duration, cost attributed
  accordingly. Not fleet servicing management.
- **Job costing** — every cost (labour, vehicle, plant, materials)
  belongs to a project and, where relevant, a specific SI/Variation/Day
  Works activity — enabling a real "are we actually making money on this
  job" answer: contract value → approved variations → pending variations
  → day works → claimed to date → actual cost to date → forecast final
  position → forecast margin.
- **Commercial alerts** — the connective tissue that makes this worth
  building at all: cost incurred against an SI with no variation raised
  yet, day works awaiting sign-off, hours logged against a project but
  not allocated to any billable activity.

**Conceptual model:** Person / Vehicle / Plant / Material → Time or Cost
→ Project → Activity → Commercial Record → Revenue/Claim → Margin.

**Why this could strengthen pricing, not just add cost:** if this is
ever built out fully, Subbie HQ stops being "a $100-200/month document/
H&S app" and becomes something closer to an operational commercial
system — with a much more direct ROI argument (preventing one missed
$5,000 variation or catching one job quietly losing money pays for a
year of subscription many times over). Worth remembering when pricing is
eventually revisited, but not a reason to build this before it's proven
wanted.

**Rough internal phasing, if/when this is ever prioritised** (not
scheduled, illustrative only):
1. Compliance + Commercial Documentation — largely where the product is
   today (H&S, Project Diary, SI, Variations, Day Works, Documents,
   Actions/External Actions)
2. Commercial Protection — Contract Review Phase 2/3, notice/deadline
   intelligence, commercial alerts, evidence chains (documented above)
3. Resource & Cost Allocation — staff, timesheets, vehicles, plant, cost
   rates, project allocation (this pillar's foundation)
4. Job Costing & Commercial Intelligence — actual/committed/forecast
   cost, revenue, margin, cost tied to specific SI/Variation/Day Works
   activity, forecast final position

**Real trade-off worth remembering when this is revisited:** the current
product has genuinely low onboarding friction — upload a contract, tag
an Update, done. Cost-rate setup and daily time-against-activity logging
raises that bar. The "Start Work" mobile flow is the right instinct for
keeping it light, but this must stay genuinely optional and never add
friction in front of the core, already-differentiated commercial-
protection workflow that works today.

### Day Works — materials, not just labour
Unlike the above, this one is small, self-contained, doesn't depend on
Phase 2/3, and was scoped as its own build prompt immediately (see
claude-code-prompt-daywork-materials.md) — expanding Day Works Sheets to
record materials line items (with optional receipt photos) alongside the
existing labour entries.
