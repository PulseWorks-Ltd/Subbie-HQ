import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { getOrganisationMembership } from "@/lib/organisation";
import { hasModuleAccess } from "@/lib/permissions";
import { getInboundEmailAddress } from "@/lib/inbound-email";

export async function GET(request: Request) {
  const userId = await requireUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const membership = await getOrganisationMembership(userId);
  if (!hasModuleAccess(membership, "incoming_emails")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
    // Sent alongside the queue so the review dialog's manual project/
    // Variation-Site Instruction override dropdowns don't need a second
    // round-trip — this org's project count is small enough that sending
    // it all upfront is simpler than an on-demand fetch per review.
    prisma.project.findMany({
      where: { organisationId: membership!.organisationId, status: "active" },
      select: {
        id: true,
        name: true,
        variationItems: {
          where: { status: { in: ["draft", "open"] } },
          select: { id: true, reference: true, title: true }
        }
      },
      orderBy: { name: "asc" }
    })
  ]);

  return NextResponse.json({
    emails,
    projects,
    inboundAddress: getInboundEmailAddress(membership!.organisationId)
  });
}
