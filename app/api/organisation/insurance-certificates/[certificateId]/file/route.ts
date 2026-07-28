import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { getOrganisationMembership } from "@/lib/organisation";
import { getSignedDownloadUrl } from "@/lib/s3";

// Any org member can download once they've reached this route legitimately
// (via the Insurance page, gated by the "insurance" module, or via a linked
// Correspondence entry in a project they already have access to) — no
// separate admin gate on the file itself.
export async function GET(request: Request, context: { params: { certificateId: string } }) {
  const userId = await requireUserId(request);
  const { certificateId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const membership = await getOrganisationMembership(userId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const certificate = await prisma.insuranceCertificate.findFirst({
    where: { id: certificateId, organisationId: membership.organisationId }
  });
  if (!certificate?.storageKey) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const signedUrl = await getSignedDownloadUrl(certificate.storageKey);

  return NextResponse.redirect(signedUrl);
}
