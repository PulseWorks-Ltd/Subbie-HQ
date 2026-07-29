import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadToS3 } from "@/lib/s3";
import { classifyAndSuggest, parseAddressList, resolveOrganisationIdFromAddress } from "@/lib/inbound-email";

// SendGrid Inbound Parse POSTs here as multipart/form-data — no signature
// header exists for this feature (unlike SendGrid's Event Webhook), so this
// is secured the same way as the cron endpoint (app/api/cron/reminders):
// a shared secret, here passed as a query param on the webhook URL itself
// since SendGrid Inbound Parse has no way to set a custom auth header.
// Configure in SendGrid as:
//   https://<app-url>/api/webhooks/inbound-email?token=<INBOUND_EMAIL_WEBHOOK_SECRET>
export async function POST(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const secret = process.env.INBOUND_EMAIL_WEBHOOK_SECRET;
  if (!secret || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const toHeader = formData.get("to")?.toString() ?? "";
  const organisationId = resolveOrganisationIdFromAddress(toHeader);

  if (!organisationId) {
    console.error(`Inbound email: could not resolve an organisation from "to" header: ${toHeader}`);
    // 200, not 4xx/5xx — SendGrid retries on non-2xx, and a malformed/unknown
    // address will never resolve on retry, so retrying only spams the logs.
    return NextResponse.json({ ok: true, skipped: "unresolved organisation" });
  }

  const organisation = await prisma.organisation.findUnique({ where: { id: organisationId } });
  if (!organisation) {
    console.error(`Inbound email: organisation ${organisationId} (parsed from "to" header) does not exist.`);
    return NextResponse.json({ ok: true, skipped: "unknown organisation" });
  }

  const fromHeader = formData.get("from")?.toString() ?? "";
  const sender = parseAddressList(fromHeader)[0] ?? fromHeader.trim();
  const ccAddresses = parseAddressList(formData.get("cc")?.toString());
  const subject = formData.get("subject")?.toString() || "(no subject)";
  // "text" already includes quoted thread history for a normal reply chain —
  // this is exactly the context Grok classification needs, no extra parsing.
  const body = formData.get("text")?.toString() || formData.get("html")?.toString() || "";

  const email = await prisma.inboundEmail.create({
    data: {
      organisationId,
      sender,
      ccAddresses,
      subject,
      body,
      status: "pending_review"
    }
  });

  const attachmentCount = Number(formData.get("attachments") ?? 0);
  for (let i = 1; i <= attachmentCount; i++) {
    const file = formData.get(`attachment${i}`);
    if (!(file instanceof File) || file.size === 0) continue;

    const buffer = new Uint8Array(await file.arrayBuffer());
    const uploadKey = `incoming-emails/${email.id}/${Date.now()}-${file.name || `attachment-${i}`}`;
    const { storageKey } = await uploadToS3({
      key: uploadKey,
      body: buffer,
      contentType: file.type || "application/octet-stream"
    });
    await prisma.inboundEmailAttachment.create({
      data: {
        inboundEmailId: email.id,
        fileName: file.name || `attachment-${i}`,
        storageKey,
        contentType: file.type || "application/octet-stream"
      }
    });
  }

  // Not awaited — SendGrid needs a fast response, and any classification
  // failure just leaves the suggestion fields blank (see classifyAndSuggest).
  void classifyAndSuggest(email.id);

  return NextResponse.json({ ok: true, emailId: email.id }, { status: 201 });
}
