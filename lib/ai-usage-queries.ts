import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { formatUserName } from "./user-display";

export type UsagePeriod = "this_month" | "last_30_days" | "all_time";

function periodStart(period: UsagePeriod): Date | undefined {
  const now = new Date();
  if (period === "this_month") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === "last_30_days") return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return undefined;
}

// Pilot-stage call volume is small enough that fetching the period's rows
// and aggregating in application code is simpler and safer than hand-rolled
// raw SQL grouping — per the task's "prefer simple, explicit code" rule.
// Revisit with a real GROUP BY query if usage volume ever makes this slow.
export async function getUsageSummary(period: UsagePeriod) {
  const since = periodStart(period);
  const logs = await prisma.aiUsageLog.findMany({
    where: since ? { createdAt: { gte: since } } : undefined,
    select: { feature: true, organisationId: true, costUsd: true, success: true, createdAt: true }
  });

  const totalCostUsd = logs.reduce((sum, l) => sum + Number(l.costUsd ?? 0), 0);
  const totalCalls = logs.length;

  const byFeatureMap = new Map<string, { calls: number; costUsd: number; failures: number }>();
  for (const log of logs) {
    const entry = byFeatureMap.get(log.feature) ?? { calls: 0, costUsd: 0, failures: 0 };
    entry.calls += 1;
    entry.costUsd += Number(log.costUsd ?? 0);
    if (!log.success) entry.failures += 1;
    byFeatureMap.set(log.feature, entry);
  }
  const byFeature = Array.from(byFeatureMap.entries())
    .map(([feature, v]) => ({
      feature,
      calls: v.calls,
      costUsd: v.costUsd,
      avgCostUsd: v.calls ? v.costUsd / v.calls : 0,
      failures: v.failures
    }))
    .sort((a, b) => b.costUsd - a.costUsd);

  const orgIds = Array.from(new Set(logs.map((l) => l.organisationId).filter((id): id is string => Boolean(id))));
  const organisations = orgIds.length
    ? await prisma.organisation.findMany({ where: { id: { in: orgIds } }, select: { id: true, name: true } })
    : [];
  const orgNameById = new Map(organisations.map((o) => [o.id, o.name]));

  const byOrgMap = new Map<string, { calls: number; costUsd: number }>();
  for (const log of logs) {
    const key = log.organisationId ?? "__none__";
    const entry = byOrgMap.get(key) ?? { calls: 0, costUsd: 0 };
    entry.calls += 1;
    entry.costUsd += Number(log.costUsd ?? 0);
    byOrgMap.set(key, entry);
  }
  const byOrganisation = Array.from(byOrgMap.entries())
    .map(([key, v]) => ({
      organisationId: key === "__none__" ? null : key,
      organisationName: key === "__none__" ? "No organisation" : (orgNameById.get(key) ?? "Unknown organisation"),
      calls: v.calls,
      costUsd: v.costUsd
    }))
    .sort((a, b) => b.costUsd - a.costUsd);

  const trendMap = new Map<string, number>();
  for (const log of logs) {
    const day = log.createdAt.toISOString().slice(0, 10);
    trendMap.set(day, (trendMap.get(day) ?? 0) + Number(log.costUsd ?? 0));
  }
  const trend = Array.from(trendMap.entries())
    .map(([date, costUsd]) => ({ date, costUsd }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { totalCostUsd, totalCalls, byFeature, byOrganisation, trend };
}

export type UsageLogFilters = {
  feature?: string;
  organisationId?: string;
  success?: boolean;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
};

export async function getUsageLogs(filters: UsageLogFilters) {
  const pageSize = filters.pageSize ?? 50;
  const page = Math.max(filters.page ?? 1, 1);

  const where: Prisma.AiUsageLogWhereInput = {
    ...(filters.feature ? { feature: filters.feature } : {}),
    ...(filters.organisationId ? { organisationId: filters.organisationId } : {}),
    ...(filters.success !== undefined ? { success: filters.success } : {}),
    ...(filters.from || filters.to
      ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
      : {})
  };

  const [logs, total] = await Promise.all([
    prisma.aiUsageLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.aiUsageLog.count({ where })
  ]);

  const orgIds = Array.from(new Set(logs.map((l) => l.organisationId).filter((id): id is string => Boolean(id))));
  const userIds = Array.from(new Set(logs.map((l) => l.userId).filter((id): id is string => Boolean(id))));
  const [organisations, users] = await Promise.all([
    orgIds.length ? prisma.organisation.findMany({ where: { id: { in: orgIds } }, select: { id: true, name: true } }) : [],
    userIds.length
      ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, lastName: true, email: true } })
      : []
  ]);
  const orgNameById = new Map(organisations.map((o) => [o.id, o.name]));
  const userById = new Map(users.map((u) => [u.id, u]));

  const enrichedLogs = logs.map((log) => {
    const user = log.userId ? userById.get(log.userId) : undefined;
    return {
      ...log,
      costUsd: log.costUsd !== null ? Number(log.costUsd) : null,
      organisationName: log.organisationId ? (orgNameById.get(log.organisationId) ?? "Unknown organisation") : null,
      userName: user ? (formatUserName(user) ?? user.email) : log.userId ? "Unknown user" : null
    };
  });

  return { logs: enrichedLogs, total, page, pageSize };
}

// Feature/organisation option lists for the raw-log filter dropdowns —
// derived from what's actually been logged rather than the full AI_FEATURES
// constant, so the filter never offers a feature/org with zero rows.
export async function getUsageFilterOptions() {
  const [features, orgIds] = await Promise.all([
    prisma.aiUsageLog.findMany({ distinct: ["feature"], select: { feature: true }, orderBy: { feature: "asc" } }),
    prisma.aiUsageLog.findMany({
      distinct: ["organisationId"],
      where: { organisationId: { not: null } },
      select: { organisationId: true }
    })
  ]);
  const organisations = orgIds.length
    ? await prisma.organisation.findMany({
        where: { id: { in: orgIds.map((o) => o.organisationId as string) } },
        select: { id: true, name: true },
        orderBy: { name: "asc" }
      })
    : [];

  return { features: features.map((f) => f.feature), organisations };
}
