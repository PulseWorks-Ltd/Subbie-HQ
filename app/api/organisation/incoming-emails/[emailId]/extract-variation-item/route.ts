import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { getOrganisationMembership } from "@/lib/organisation";
import { hasModuleAccess } from "@/lib/permissions";
import { extractVariationItemDetailsFromEmail } from "@/lib/inbound-email";

const requestSchema = z.object({ type: z.enum(["variation", "site_instruction"]) });

// Preview-only, mirrors the manual-upload parse route
// (variation-items/parse/route.ts) — nothing is persisted here. The
// reviewer confirms/edits the result, and it's only saved once they submit
// the actual "file" action (see [emailId]/route.ts's createVariationItem).
export async function POST(request: Request, context: { params: { emailId: string } }) {
  const userId = await requireUserId(request);
  const { emailId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const membership = await getOrganisationMembership(userId);
  if (!hasModuleAccess(membership, "incoming_emails")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const email = await prisma.inboundEmail.findFirst({
    where: { id: emailId, organisationId: membership!.organisationId }
  });
  if (!email) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const payload = requestSchema.parse(await request.json());

  try {
    const extracted = await extractVariationItemDetailsFromEmail(emailId, payload.type, userId);
    return NextResponse.json({ extracted });
  } catch (error) {
    console.error(`Failed to extract variation item details from inbound email ${emailId}:`, error);
    return NextResponse.json(
      { error: "Could not extract details automatically. You can still fill them in manually." },
      { status: 422 }
    );
  }
}
