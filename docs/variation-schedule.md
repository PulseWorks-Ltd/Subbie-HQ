# Variation Package scheduling automation

Manually clicking "Request Approval" on a Variation Package (see `docs/` — built the same session, just before this) works, but still requires someone to remember to do it every month, on time, per the contract's actual notice/claim deadline. This closes that gap — the highest-stakes automation in the app, since the top tier can put a real commercial document in front of an external person with nobody having reviewed it first.

## The schedule itself

Set per-project in **Settings → Contract Terms**, either from AI extraction (suggest-then-confirm, same pattern as every other Contract Terms field) or manual entry:
- **Fixed day of the month** (e.g. "the 20th"), or
- **N working days before month-end**.

"Working day" = Monday-Friday (`lib/working-days.ts`) — like `lib/day-works-rates.ts`, this doesn't attempt a full NZ/Aus public holiday calendar (no region/jurisdiction field exists yet). A fixed date that lands on a weekend rolls back to the preceding working day.

## Automation modes

Set per-project in **Settings → Variation Package automation**:
- **Manual** (default) — nothing changes; Request Approval is still a manual click.
- **Automatic with approval** — 2 working days before the deadline, the Package is auto-generated and the team (everyone with Variations/Site Instructions module access) is emailed a warning with a link to Settings, where anyone can cancel. If not cancelled, the exact package generated at warning time is sent externally on the real deadline.
- **Fully automatic** — no warning stage at all: generates and sends directly on the deadline.

The 2-working-day warning is computed as 2 working days *before* the real deadline (`lib/variation-schedule.ts`'s `computeWarningDate`) — the deadline itself is never moved to make room for the warning.

Turning on either automatic mode attributes every auto-generated/sent package to whoever turned it on (`Project.variationAutomationSetByUserId`) — deliberately not a fabricated "system" user, since a real person chose to enable it.

## Recipients

A project-level "Payment Claim / Variation Recipients" list (**Settings**), each a saved Main Contractor contact or a typed one-off, with a To/Cc role. "To" recipients each get their own actionable no-login approval link (same mechanism as a manual Request Approval); "Cc" recipients get the same email as a plain FYI copy via real email cc — no actionable link of their own.

## The cycle machine

One `VariationScheduleRun` row per project per calendar month (`lib/variation-schedule.ts`), keyed by `(projectId, cycleMonth)` — this is what makes the daily sweep idempotent (safe to run more than once a day) and what the cancellation button targets. Status: `pending_warning → warned → sent`, or `cancelled` / `skipped_no_items` (no eligible open Variation/SI when the cycle needed to act) at any point before `sent`.

If a schedule is configured (or automation is first turned on) after that month's deadline has already passed, the run rolls forward to next month's cycle rather than firing a stale, backdated send.

## The job itself

`POST /api/cron/variation-schedule`, same shared-secret (`CRON_SECRET`) + `Authorization: Bearer` pattern as every other cron route in this app (see `docs/reminders.md`). Calls `runVariationScheduleSweep()`, once daily.

**Railway setup**: identical to `docs/reminders.md`'s — a Cron Job service, schedule early morning NZ/Aus time, command:
```bash
curl -fsS -X POST "https://<your-app-domain>/api/cron/variation-schedule" -H "Authorization: Bearer $CRON_SECRET"
```

## Testing manually (staging only — never against production)

Same rule as every other cron job: never test against production, it sends real emails and real external approval requests. `runVariationScheduleSweep(now)` accepts an explicit `now` for exercising a specific cycle stage without waiting on the calendar.
