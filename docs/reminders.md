# Deadline reminders

The Dashboard already shows overdue/upcoming Variations, Site Instructions, and Health & Safety document expiries — but nothing proactively told anyone until they opened the app. This is the first scheduled job in Subbie HQ, closing that gap.

## What it checks

Once a day, for every project:
- **VariationItem** (both Variation and Site Instruction type) rows with a `dueAt` and not `complete`
- **SafetyDocument** rows with an `expiresAt`

Each is checked against four stages, based on days until the date: **3 days away**, **1 day away**, **due/expiring today**, **overdue/expired**. A reminder is sent once per stage per item — a `lastReminderStage` field on each model tracks the most recent stage sent, so re-running the job never re-sends a stage, and an overdue item gets exactly one "now overdue" reminder rather than one every day it stays overdue.

`TODO`: Payment Claims due dates (`Project.nextClaimDate`) aren't wired in yet — that module doesn't exist. The hook point is noted directly in `lib/reminders.ts`.

## Who gets notified

Recipients are computed the same way every other permission-gated view in the app works: for org-owned projects, every `OrganisationMember` with access to the relevant module (`variations`, `site_instructions`, or `health_safety`) via `hasModuleAccess`; for legacy org-less projects, every `ProjectMember` (unrestricted, matching `requireModuleAccess`'s existing fallback). An H&S-only user will never get a Variation reminder, and vice versa.

Both existing notification channels are reused — no new channel was built:
- **Email** via SendGrid (`lib/email.ts`'s `sendReminderEmail` — plain HTML, no dynamic template yet; add `SENDGRID_REMINDER_TEMPLATE_ID` and switch to a template later if a branded design is wanted)
- **Push** via `sendPushToUser` (existing web-push subscriptions)

## The job itself

`POST /api/cron/reminders`, protected by a shared secret (`CRON_SECRET`) checked against an `Authorization: Bearer <secret>` header. Calls `runReminderCheck()` from `lib/reminders.ts` and returns/logs a summary (how many items were checked, how many notifications were sent, one line per reminder actually sent).

This is triggered via an HTTP endpoint + Railway Cron Job, not an in-process `node-cron` timer — deliberately, because the web service can run multiple replicas, and an in-process timer would fire once per replica (duplicating every reminder). A Cron Job service runs the command exactly once regardless of replica count, and needs no new infrastructure dependency.

**Railway setup** (one-time, done in the Railway dashboard, not in code):
1. Add a new service → **Cron Job** in the same Railway project as the app.
2. Schedule: early morning NZ/Aus time, e.g. `0 17 * * *` (5pm UTC ≈ 5am NZDT / 3am AEDT).
3. Command:
   ```bash
   curl -fsS -X POST "https://<your-app-domain>/api/cron/reminders" -H "Authorization: Bearer $CRON_SECRET"
   ```
4. Set `CRON_SECRET` as an environment variable on the Cron Job service, matching the same value set on the web service.

## Testing manually (staging only — never against production)

Never test this against production; it sends real emails/push notifications. Follow the [staging verification workflow](staging.md#how-to-verify-a-feature-end-to-end-safely) first, then with the staging dev server running:

```bash
curl -X POST http://localhost:3000/api/cron/reminders -H "Authorization: Bearer $CRON_SECRET"
```

Run it as many times as needed — a second run with nothing newly crossing a threshold sends zero additional reminders, which is exactly the no-duplicate-sends behaviour to confirm.
