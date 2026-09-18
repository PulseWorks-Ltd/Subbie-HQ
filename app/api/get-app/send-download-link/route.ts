import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { formatUserName } from "@/lib/user-display";
import { sendDownloadLinkEmail } from "@/lib/email";
import { isDownloadLinkRateLimited, recordDownloadLinkRequest } from "@/lib/download-link-rate-limit";

const sendDownloadLinkSchema = z.object({ email: z.string().email() });

// "Invite a teammate onto the app" — deliberately requires a real logged-in
// sender (unlike, say, /api/auth/request-password-reset, which is the
// unauthenticated entry point for a totally different reason). This is
// intentionally NOT a public/anonymous mailer: the recipient's inbox sees
// a real name behind the invite, and the rate limit is keyed to a real
// accountable account rather than an IP — see lib/download-link-rate-limit.ts.
export async function POST(request: Request) {
  const userId = await requireUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = sendDownloadLinkSchema.parse(await request.json());
  const email = payload.email.toLowerCase().trim();

  if (await isDownloadLinkRateLimited(userId, email)) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }
  await recordDownloadLinkRequest(userId, email);

  const sender = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true, email: true }
  });
  if (!sender) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const senderName = formatUserName(sender) ?? sender.email;
  const baseUrl = process.env.AUTH_URL ?? new URL(request.url).origin;

  await sendDownloadLinkEmail({ to: email, senderName, mobileUrl: `${baseUrl}/m` });

  return NextResponse.json({ ok: true });
}
