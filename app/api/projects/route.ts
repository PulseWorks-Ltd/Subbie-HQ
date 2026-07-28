import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { getOrganisationMembership, getVisibleProjectsWhere } from "@/lib/organisation";

const createProjectSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional()
});

export async function GET(request: Request) {
  const userId = await requireUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projects = await prisma.project.findMany({
    where: await getVisibleProjectsWhere(userId),
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  const userId = await requireUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = createProjectSchema.parse(await request.json());

  const membership = await getOrganisationMembership(userId);
  if (membership && !membership.isAdmin) {
    return NextResponse.json({ error: "Only an organisation Admin can create new projects." }, { status: 403 });
  }

  const project = await prisma.project.create({
    data: {
      name: payload.name,
      code: payload.code,
      organisationId: membership?.organisationId,
      members: {
        create: {
          userId,
          role: "owner"
        }
      }
    }
  });

  return NextResponse.json({ project }, { status: 201 });
}
