import { NextResponse } from "next/server";
import { z } from "zod";
import { resetPassword } from "@/lib/password-reset";

// min(8) matches the exact rule used at signup (app/api/auth/register/route.ts)
// and My Settings (app/api/account/route.ts) — reused, not reinvented.
const requestSchema = z.object({ token: z.string().min(1), password: z.string().min(8) });

export async function POST(request: Request) {
  const payload = requestSchema.parse(await request.json());

  const result = await resetPassword(payload.token, payload.password);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
