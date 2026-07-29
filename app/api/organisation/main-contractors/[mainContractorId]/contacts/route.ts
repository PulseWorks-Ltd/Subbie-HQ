import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { requireOrganisationAdmin } from "@/lib/organisation";

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  role: z.string().optional()
});

export async function POST(request: Request, context: { params: { mainContractorId: string } }) {
  const userId = await requireUserId(request);
  const { mainContractorId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = await requireOrganisationAdmin(userId);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const mainContractor = await prisma.mainContractor.findFirst({
    where: { id: mainContractorId, organisationId: admin.organisationId }
  });
  if (!mainContractor) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const payload = createSchema.parse(await request.json());

  const contact = await prisma.mainContractorContact.create({
    data: {
      mainContractorId,
      name: payload.name,
      email: payload.email || undefined,
      phone: payload.phone || undefined,
      role: payload.role || undefined
    }
  });

  return NextResponse.json({ contact }, { status: 201 });
}
