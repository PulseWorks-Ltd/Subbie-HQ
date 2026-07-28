// Runs the given command with DATABASE_URL forced to STAGING_DATABASE_URL,
// regardless of whatever DATABASE_URL happens to be set to in the ambient
// environment or .env file. This is what makes "use staging" the easy,
// no-thought-required default for db:staging:* scripts.
//
// Usage: node scripts/with-staging-db.js <command> [...args]

import { spawnSync } from "node:child_process";
import { config } from "dotenv";

// Plain `node` doesn't auto-load .env the way `next` and the `prisma` CLI
// do — load it explicitly so STAGING_DATABASE_URL is available whether this
// runs via `npm run db:staging:*` or directly.
config();

const stagingUrl = process.env.STAGING_DATABASE_URL;
if (!stagingUrl) {
  console.error("\n✖ STAGING_DATABASE_URL is not set. Add it to .env before running db:staging:* scripts.\n");
  process.exit(1);
}

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("Usage: node scripts/with-staging-db.js <command> [...args]");
  process.exit(1);
}

const result = spawnSync(command, args, {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: stagingUrl }
});

process.exit(result.status ?? 1);
