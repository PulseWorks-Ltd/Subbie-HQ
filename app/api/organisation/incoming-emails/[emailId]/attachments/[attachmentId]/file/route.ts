import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { getOrganisationMembership } from "@/lib/organisation";
import { hasModuleAccess } from "@/lib/permissions";
import { getSignedDownloadUrl } from "@/lib/s3";

export async function GET(request: Request, context: { params: { emailId: string; attachmentId: string } }) {
  const userId = await requireUserId(request);
  const { emailId, attachmentId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const membership = await getOrganisationMembership(userId);
  if (!hasModuleAccess(membership, "incoming_emails")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const attachment = await prisma.inboundEmailAttachment.findFirst({
    where: { id: attachmentId, inboundEmailId: emailId, inboundEmail: { organisationId: membership!.organisationId } }
  });
  if (!attachment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const signedUrl = await getSignedDownloadUrl(attachment.storageKey);
  return NextResponse.redirect(signedUrl);
}
