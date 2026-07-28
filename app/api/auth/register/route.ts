import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { PRESETS } from "@/lib/permissions";

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8)
});

export async function POST(request: Request) {
  const payload = registerSchema.parse(await request.json());
  const email = payload.email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(payload.password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      name: payload.name,
      passwordHash,
      organisationMemberships: {
        create: {
          isAdmin: true,
          title: PRESETS.admin.label,
          modules: PRESETS.admin.modules,
          organisation: {
            create: {
              name: `${payload.name}'s Organisation`
            }
          }
        }
      }
    },
    select: { id: true, email: true, name: true }
  });

  return NextResponse.json({ user }, { status: 201 });
}
