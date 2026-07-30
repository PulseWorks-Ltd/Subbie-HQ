import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrganisationMembership } from "@/lib/organisation";
import { hasModuleAccess } from "@/lib/permissions";
import { getInboundEmailAddress } from "@/lib/inbound-email";
import { IncomingEmailsView } from "@/components/incoming-emails/incoming-emails-view";

export default async function IncomingEmailsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const membership = await getOrganisationMembership(session.user.id);
  if (!hasModuleAccess(membership, "incoming_emails")) {
    redirect("/");
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
        // Not status-filtered: the review dialog uses this list both to link
        // correspondence to an item and to detect "this Site
        // Instruction/Variation already exists" before creating a new one —
        // a completed item still counts as an existing one for that check.
        variationItems: {
          select: { id: true, reference: true, title: true, type: true, status: true }
        }
      },
      orderBy: { name: "asc" }
    })
  ]);

  return (
    <IncomingEmailsView
      emails={emails}
      projects={projects}
      inboundAddress={getInboundEmailAddress(membership!.organisationId)}
    />
  );
}
