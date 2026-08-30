import { prisma } from "./prisma";
import { formatUserName } from "./user-display";

export type OrganisationMemberRow = {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  title: string | null;
  joinedAt: string;
};

export type OrganisationAccessEventRow = {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  planTier: string | null;
  source: string;
  createdAt: string;
};

export type OrganisationOverviewRow = {
  id: string;
  name: string;
  trade: string | null;
  accessStatus: string;
  planTier: string | null;
  createdAt: string;
  pilotAccessGrantedAt: string | null;
  trialEndsAt: string | null;
  memberCount: number;
  members: OrganisationMemberRow[];
  accessEvents: OrganisationAccessEventRow[];
};

// One full fetch, no server-side pagination — organisation count is small
// at this stage (early pilot phase), so filtering/searching happens
// client-side over this one list. If that stops being true, this can grow
// into the same server-paginated pattern lib/ai-usage-queries.ts already
// uses for the (much higher-volume) AI usage log.
export async function getOrganisationsOverview(): Promise<OrganisationOverviewRow[]> {
  const organisations = await prisma.organisation.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      members: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { firstName: true, lastName: true, email: true } } }
      },
      accessEvents: { orderBy: { createdAt: "desc" } }
    }
  });

  return organisations.map((org) => ({
    id: org.id,
    name: org.name,
    trade: org.trade,
    accessStatus: org.accessStatus,
    planTier: org.planTier,
    createdAt: org.createdAt.toISOString(),
    pilotAccessGrantedAt: org.pilotAccessGrantedAt?.toISOString() ?? null,
    trialEndsAt: org.trialEndsAt?.toISOString() ?? null,
    memberCount: org.members.length,
    members: org.members.map((member) => ({
      id: member.id,
      name: formatUserName(member.user) ?? member.user.email,
      email: member.user.email,
      isAdmin: member.isAdmin,
      title: member.title,
      joinedAt: member.createdAt.toISOString()
    })),
    accessEvents: org.accessEvents.map((event) => ({
      id: event.id,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      planTier: event.planTier,
      source: event.source,
      createdAt: event.createdAt.toISOString()
    }))
  }));
}
