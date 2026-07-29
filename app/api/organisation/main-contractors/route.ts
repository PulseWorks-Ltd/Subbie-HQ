import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { getOrganisationMembership, requireOrganisationAdmin } from "@/lib/organisation";
import { hasModuleAccess } from "@/lib/permissions";

const createSchema = z.object({
  name: z.string().min(1)
});

export async function GET(request: Request) {
  const userId = await requireUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const membership = await getOrganisationMembership(userId);
  if (!hasModuleAccess(membership, "main_contractors")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const mainContractors = await prisma.mainContractor.findMany({
    where: { organisationId: membership!.organisationId },
    include: {
      contacts: { orderBy: { createdAt: "asc" } },
      projects: { select: { id: true, name: true, status: true } }
    },
    orderBy: { name: "asc" }
  });

  return NextResponse.json({ mainContractors });
}

export async function POST(request: Request) {
  const userId = await requireUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = await requireOrganisationAdmin(userId);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = createSchema.parse(await request.json());

  const mainContractor = await prisma.mainContractor.create({
    data: { organisationId: admin.organisationId, name: payload.name }
  });

  return NextResponse.json({ mainContractor }, { status: 201 });
}
