import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { getUsageSummary, getUsageLogs, getUsageFilterOptions } from "@/lib/ai-usage-queries";
import { AiUsageDashboard } from "@/components/platform-admin/ai-usage-dashboard";

// Deliberately outside the (app) route group — this is platform-owner
// scoped, not organisation/admin scoped, so it doesn't get the org-context
// TopNav or any other assumption that the viewer belongs to an
// organisation. Access is gated on User.isPlatformAdmin, a flag that's only
// ever set via a direct database write (never through any UI) — see
// lib/platform-admin.ts. Any user without it, including an org Admin or an
// unauthenticated visitor, gets an ordinary 404 here, not a
// permission-denied page that would confirm this route exists.
export default async function PlatformAdminAiUsagePage() {
  const session = await auth();
  if (!session?.user?.id || !(await isPlatformAdmin(session.user.id))) {
    notFound();
  }

  const [summary, logsResult, filterOptions] = await Promise.all([
    getUsageSummary("this_month"),
    getUsageLogs({ page: 1 }),
    getUsageFilterOptions()
  ]);

  // JSON round-trip so the initial server-fetched shape exactly matches
  // what the client component later gets back from its own fetch() calls to
  // the API routes (dates as ISO strings, Decimal-derived costs as plain
  // numbers) — RSC's own serialization reconstructs Date objects instead,
  // which would otherwise mismatch LogRow's string-typed createdAt.
  return (
    <AiUsageDashboard
      initialPeriod="this_month"
      initialSummary={JSON.parse(JSON.stringify(summary))}
      initialLogs={JSON.parse(JSON.stringify(logsResult))}
      filterOptions={filterOptions}
    />
  );
}
