import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireOrganisationAdmin } from "@/lib/organisation";
import { TeamView } from "@/components/team/team-view";

export default async function TeamPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const admin = await requireOrganisationAdmin(session.user.id);
  if (!admin) {
    redirect("/");
  }

  const [members, invites] = await Promise.all([
    prisma.organisationMember.findMany({
      where: { organisationId: admin.organisationId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" }
    }),
    prisma.organisationInvite.findMany({
      where: { organisationId: admin.organisationId, acceptedAt: null },
      orderBy: { createdAt: "desc" }
    })
  ]);

  return (
    <TeamView
      organisationName={admin.organisation.name}
      currentUserId={session.user.id}
      members={members}
      invites={invites}
      variationCompletionMode={admin.organisation.variationCompletionMode}
    />
  );
}
