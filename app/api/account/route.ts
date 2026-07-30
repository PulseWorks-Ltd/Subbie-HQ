import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";

const updateAccountSchema = z
  .object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    jobTitle: z.string().optional(),
    currentPassword: z.string().optional(),
    newPassword: z.string().min(8).optional()
  })
  .refine((data) => !data.newPassword || data.currentPassword, {
    message: "Current password is required to set a new password.",
    path: ["currentPassword"]
  });

// A user updating their own profile/password — deliberately separate from
// the org-admin-gated /api/organisation/members routes, since this only
// ever acts on the calling user's own row (no memberId in the URL, no admin
// check needed).
export async function PATCH(request: Request) {
  const userId = await requireUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = updateAccountSchema.parse(await request.json());

  const data: { firstName?: string; lastName?: string; jobTitle?: string | null; passwordHash?: string } = {
    firstName: payload.firstName,
    lastName: payload.lastName,
    jobTitle: payload.jobTitle || null
  };

  if (payload.newPassword) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
    if (!user) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const currentPasswordMatches = await bcrypt.compare(payload.currentPassword!, user.passwordHash);
    if (!currentPasswordMatches) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
    }
    data.passwordHash = await bcrypt.hash(payload.newPassword, 10);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, firstName: true, lastName: true, jobTitle: true, email: true }
  });

  return NextResponse.json({ user: updated });
}
