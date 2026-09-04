import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { requireOrganisationAdmin } from "@/lib/organisation";

const updateOrganisationSchema = z.object({
  variationCompletionMode: z.enum(["auto", "requires_confirmation"]).optional(),
  name: z.string().min(1).optional(),
  trade: z.string().min(1).nullable().optional(),
  jurisdiction: z.string().min(1).nullable().optional(),
  // Payment Claim PDF FROM-block details.
  address: z.string().min(1).nullable().optional(),
  gstNumber: z.string().min(1).nullable().optional()
});

export async function PATCH(request: Request) {
  const userId = await requireUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = await requireOrganisationAdmin(userId);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = updateOrganisationSchema.parse(await request.json());

  const organisation = await prisma.organisation.update({
    where: { id: admin.organisationId },
    data: {
      variationCompletionMode: payload.variationCompletionMode,
      name: payload.name,
      trade: payload.trade,
      jurisdiction: payload.jurisdiction,
      address: payload.address,
      gstNumber: payload.gstNumber
    }
  });

  return NextResponse.json({ organisation });
}
