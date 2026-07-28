# Staging database — why it exists, and how to use it safely

## Why this exists

On 2026-07-28, a Prisma command (`prisma migrate diff --shadow-database-url`) was accidentally pointed at the real production database connection string instead of a disposable one. Prisma treats whatever you pass as `--shadow-database-url` as safe to wipe and rebuild — so it wiped every row of production data. The data lost was only test data and the app itself was never damaged (the schema was fine, only the rows were gone), but it should never have been possible to happen at all.

Staging exists so that **no migration, no experiment, and no "let me just check something" command ever needs to touch production again until it's already been proven safe.** Production should only ever be touched by one specific, narrow command, run manually, after everything has already worked on staging.

## The database services

- **Production** — the real Railway Postgres service the live app uses. Its connection string lives in Railway's environment variables for the production app service. Nobody should need to put it in a local `.env` file at all, day to day.
- **Staging** — a second, separate Railway Postgres service. Freely disposable. Safe to wipe, reset, and reseed as often as needed. Its connection string goes in `STAGING_DATABASE_URL`.

## One-time setup

1. Copy `.env.example` → `.env` if you haven't already, and fill in `STAGING_DATABASE_URL` with the real staging connection string (get it from Railway → the staging Postgres service → Connect).
2. Copy `.env.staging.example` → `.env.staging` and fill in the same staging `DATABASE_URL`, plus copies of your other local `.env` values (S3, SendGrid, VAPID, etc. can point at the same non-prod configs you already use).
3. Both `.env` and `.env.staging` are git-ignored — never commit real connection strings.

## Everyday staging commands

All of these are hard-wired to use `STAGING_DATABASE_URL` — they override whatever `DATABASE_URL` happens to be set to, so there's no way to "accidentally forget" which database you're pointed at:

```bash
npm run db:staging:migrate   # applies/creates migrations against staging
npm run db:staging:studio    # opens Prisma Studio against staging, to eyeball data
npm run db:staging:reset     # wipes and reseeds staging — safe to run freely
npm run dev:staging          # runs the actual app (npm run dev) against staging
```

`npm run dev:staging` also shows a bright amber "STAGING" banner at the top of every page, and logs `Database target: STAGING` in the server console on startup — so it's never ambiguous which database a running dev server is actually talking to. If you don't see the banner, you're on production or your normal local database — be careful.

## How to verify a feature end-to-end safely

**This is the process to follow before considering any feature finished, every time — no exceptions.**

1. Run `npm run db:staging:migrate` to bring staging's schema up to date.
2. Run `npm run dev:staging` (not `npm run dev`) to start the app pointed at staging.
3. Confirm the amber "STAGING" banner is visible at the top of the page. If it's not there, stop — you're not actually testing against staging.
4. Test the feature for real: create test data, click through the actual flows, confirm emails/push notifications/whatever the feature does actually happens.
5. When you're done, either run `npm run db:staging:reset` (wipes everything) or manually delete just the test rows you created, using Prisma Studio (`npm run db:staging:studio`) — either is fine, since staging is disposable.

Because staging is a completely separate database, nothing you do here can ever affect real customer data, no matter what goes wrong.

## The one and only safe way to touch production

Once a migration has been tested and confirmed working on staging (via the process above), the **only** command allowed to apply it to production is:

```bash
npm run db:prod:migrate:deploy
```

This command:
- Only ever runs `prisma migrate deploy` — which applies already-written, already-tested migration files. It never generates new migrations, never diffs schemas, and never resets anything.
- Refuses to run at all unless `DATABASE_URL` is currently set to the real production connection string (checked against `PROD_DB_HOST_ALLOWLIST` in `.env`) **and** the command contains no dangerous patterns (`--shadow-database-url`, `diff`, `reset`).
- Requires you to have deliberately set `DATABASE_URL` to production yourself first (e.g. via `railway run --service <production-service> -- npm run db:prod:migrate:deploy`, or by temporarily exporting it in your shell for that one command). It is never picked up automatically from a `.env` file — this is intentional friction. Staging is the easy path; production is the deliberate one.

If the guard rail blocks the command, that's it working as intended — don't work around it. Fix whatever it flagged (wrong host, or a dangerous flag) instead.

## What never to do

- **Never** run `prisma migrate dev`, `prisma db push`, `prisma migrate reset`, or `prisma migrate diff --shadow-database-url` with the production connection string — not even "just to preview," not even "just this once."
- **Never** paste the production `DATABASE_URL` into your local `.env` "temporarily" — use staging instead, or `railway run` for the one narrow production command above.
- **Never** treat `--shadow-database-url` as a safe read-only preview flag against anything other than a genuinely disposable database — Prisma will wipe and rebuild whatever you point it at.
- **Never** bypass `db:prod:migrate:deploy`'s guard rail by running `prisma` commands directly against production — if the guard rail is in the way, that's the point.
