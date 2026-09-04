import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSignedDownloadUrl } from "@/lib/s3";
import { getClientIp, isPublicTokenLookupRateLimited, recordFailedPublicTokenLookup } from "@/lib/public-token-rate-limit";
import crypto from "crypto";

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

// Genuinely public — no auth. Same rate-limiting as the main token route
// (app/api/external-actions/[token]/route.ts). Only ever serves the ONE
// specific package this token's ExternalAction actually references, never
// any other file — a token with no variationPackageId (a generic item/
// sheet approval, not a package approval) gets a 404 here regardless of
// how valid it otherwise is.
export async function GET(request: Request, context: { params: { token: string } }) {
  const ip = getClientIp(request);
  if (await isPublicTokenLookupRateLimited("external-action", ip)) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  const action = await prisma.externalAction.findUnique({
    where: { tokenHash: hashToken(context.params.token) },
    select: { status: true, expiresAt: true, variationPackage: { select: { storageKey: true } } }
  });

  if (!action || !action.variationPackage) {
    await recordFailedPublicTokenLookup("external-action", ip);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (action.status === "expired" || (action.status === "pending" && action.expiresAt < new Date())) {
    return NextResponse.json({ error: "This link has expired." }, { status: 404 });
  }

  const signedUrl = await getSignedDownloadUrl(action.variationPackage.storageKey);
  return NextResponse.redirect(signedUrl);
}
