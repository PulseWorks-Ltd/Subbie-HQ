import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrganisationMembership } from "@/lib/organisation";
import { hasModuleAccess } from "@/lib/permissions";
import { getInboundEmailAddress } from "@/lib/inbound-email";
import { MobileIncomingEmailsView } from "@/components/mobile/mobile-incoming-emails-view";

// Mirrors app/(app)/incoming-emails/page.tsx's queries exactly (Task 1.2 —
// reuse existing logic, don't build a parallel data-fetching path) — same
// org-level module gate, same pending-review emails query, same projects
// list (for the review dialog's project/item pickers). Org-level, not
// project-scoped, same as desktop, hence living as a peer of /m rather
// than nested under /m/[projectId].
export default async function MobileIncomingEmailsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/m/incoming-emails");
  }

  const membership = await getOrganisationMembership(session.user.id);
  if (!hasModuleAccess(membership, "incoming_emails")) {
    redirect("/m");
  }

  const [emails, projects] = await Promise.all([
    prisma.inboundEmail.findMany({
      where: { organisationId: membership!.organisationId, status: "pending_review" },
      include: {
        attachments: true,
        suggestedProject: { select: { id: true, name: true } },
        suggestedVariationItem: { select: { id: true, reference: true, title: true } }
      },
      orderBy: { receivedAt: "desc" }
    }),
    prisma.project.findMany({
      where: { organisationId: membership!.organisationId, status: "active" },
      select: {
        id: true,
        name: true,
        variationItems: {
          select: { id: true, reference: true, title: true, type: true, status: true }
        }
      },
      orderBy: { name: "asc" }
    })
  ]);

  return (
    <MobileIncomingEmailsView
      emails={emails}
      projects={projects}
      inboundAddress={getInboundEmailAddress(membership!.organisationId)}
    />
  );
}
