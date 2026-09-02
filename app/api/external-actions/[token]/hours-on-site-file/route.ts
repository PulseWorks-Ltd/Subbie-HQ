import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getSheetWithDetail } from "@/lib/hours-on-site";
import { generateHoursOnSitePdf, paramsFromSheet } from "@/lib/hours-on-site-pdf";
import { getClientIp, isExternalActionLookupRateLimited, recordFailedExternalActionLookup } from "@/lib/external-action-rate-limit";

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

// Genuinely public — no auth. Same rate-limiting/token-hash pattern as
// ../package-file/route.ts, but generates the PDF FRESH from the sheet's
// CURRENT data rather than redirecting to a stored file — Hours on Site
// deliberately has no stored/frozen PDF (see hours-on-site-pdf.ts), since
// hours/workers must stay editable right up until approval. Once approved
// the sheet is locked (lib/hours-on-site.ts), so a regeneration after that
// point always reproduces the exact same bytes anyway. A token with no
// hoursOnSiteSheetId (a generic item/package approval, not an Hours on
// Site one) gets a 404 here regardless of how valid it otherwise is.
export async function GET(request: Request, context: { params: { token: string } }) {
  const ip = getClientIp(request);
  if (await isExternalActionLookupRateLimited(ip)) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  const action = await prisma.externalAction.findUnique({
    where: { tokenHash: hashToken(context.params.token) },
    select: { status: true, expiresAt: true, hoursOnSiteSheetId: true }
  });

  if (!action || !action.hoursOnSiteSheetId) {
    await recordFailedExternalActionLookup(ip);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (action.status === "expired" || (action.status === "pending" && action.expiresAt < new Date())) {
    return NextResponse.json({ error: "This link has expired." }, { status: 404 });
  }

  const sheet = await getSheetWithDetail(action.hoursOnSiteSheetId);
  if (!sheet) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pdfBytes = await generateHoursOnSitePdf(paramsFromSheet(sheet));
  const dateLabel = sheet.startedAt.toISOString().slice(0, 10);

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Hours on Site - ${sheet.project.name} - ${dateLabel}.pdf"`
    }
  });
}
