// Guard rail run by every db:prod:* npm script, before it's allowed to touch
// the database. Deliberately blunt: it would rather block a legitimate
// production command than silently allow another accidental wipe like the
// one on 2026-07-28 (real DATABASE_URL passed as --shadow-database-url,
// which Prisma treats as disposable and rebuilds from scratch).
//
// Usage: node scripts/check-db-target.js <the prisma args about to be run...>
// e.g.:  node scripts/check-db-target.js migrate deploy

const DANGEROUS_ARG_PATTERNS = ["--shadow-database-url", "diff", "reset"];

function fail(message) {
  console.error(`\n✖ db:prod guard rail blocked this command.\n  ${message}\n`);
  process.exit(1);
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  fail("DATABASE_URL is not set. Refusing to run a db:prod:* script without an explicit production connection string.");
}

// Deliberately host:port ("url.host"), not just hostname — Railway's TCP
// proxy puts many unrelated services behind the same shared proxy hostname
// (e.g. sakura.proxy.rlwy.net) and distinguishes them purely by port, so a
// hostname-only check would treat staging and production as the same host.
let hostAndPort;
try {
  hostAndPort = new URL(dbUrl).host;
} catch {
  fail("DATABASE_URL is not a valid connection string.");
}

const allowlist = (process.env.PROD_DB_HOST_ALLOWLIST ?? "")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);

if (allowlist.length === 0) {
  fail(
    "PROD_DB_HOST_ALLOWLIST is not set. Add the production Postgres host:port to .env before running any db:prod:* script."
  );
}

if (!allowlist.includes(hostAndPort)) {
  fail(
    `DATABASE_URL host "${hostAndPort}" is not in PROD_DB_HOST_ALLOWLIST. This does not look like the production database — refusing to continue.`
  );
}

const intendedArgs = process.argv.slice(2);
const argsString = intendedArgs.join(" ").toLowerCase();
for (const pattern of DANGEROUS_ARG_PATTERNS) {
  if (argsString.includes(pattern)) {
    fail(
      `The command "${intendedArgs.join(" ")}" contains a banned pattern ("${pattern}"). ` +
        "migrate diff, --shadow-database-url, and migrate reset must never be run against production."
    );
  }
}

console.log(
  `✓ db:prod guard rail passed — DATABASE_URL host "${hostAndPort}" is allow-listed, command "${intendedArgs.join(" ") || "(none supplied)"}" contains no banned patterns.`
);
