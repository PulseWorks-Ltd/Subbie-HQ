import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth";
import { requireOrganisationAdmin } from "@/lib/organisation";
import { prisma } from "@/lib/prisma";
import { recordAccessStatusChange } from "@/lib/organisation-access-log";

const requestSchema = z.object({ code: z.string().min(1) });

// Redeeming the shared pilot code unlocks the WHOLE organisation, so this
// is admin-only for the same reason checkout/portal are — an org-wide
// access decision, not a per-user preference.
export async function POST(request: Request) {
  const userId = await requireUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await requireOrganisationAdmin(userId);
  if (!membership) {
    return NextResponse.json({ error: "Only an organisation admin can activate access." }, { status: 403 });
  }

  const payload = requestSchema.parse(await request.json());
  const pilotCode = process.env.PILOT_ACCESS_CODE;

  if (!pilotCode || payload.code.trim() !== pilotCode) {
    return NextResponse.json({ error: "That code isn't valid. Check it and try again." }, { status: 400 });
  }

  const existing = await prisma.organisation.findUnique({
    where: { id: membership.organisationId },
    select: { accessStatus: true, planTier: true }
  });

  await prisma.organisation.update({
    where: { id: membership.organisationId },
    data: { accessStatus: "pilot", pilotAccessGrantedAt: new Date() }
  });

  await recordAccessStatusChange({
    organisationId: membership.organisationId,
    fromStatus: existing?.accessStatus ?? null,
    toStatus: "pilot",
    planTier: existing?.planTier ?? null,
    source: "pilot_code"
  });

  return NextResponse.json({ ok: true });
}
