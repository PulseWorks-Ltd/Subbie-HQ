import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { generatePaymentClaimAppendixB1Pdf } from "@/lib/payment-claim-pdf";
import { sendPaymentClaimEmail } from "@/lib/email";
import { uploadToS3 } from "@/lib/s3";

const recipientSchema = z
  .object({
    contactId: z.string().optional(),
    email: z.string().email().optional()
  })
  .refine((r) => r.contactId || r.email, { message: "Each recipient needs either a saved contact or an email address." });

const sendSchema = z.object({
  to: z.array(recipientSchema).min(1),
  cc: z.array(recipientSchema).default([]),
  subject: z.string().min(1),
  body: z.string().min(1)
});

// Pre-Launch Feature 5 — the actual "Send to client" action: generates a
// fresh PDF (so what's sent always matches the claim's current numbers,
// same reasoning as the standalone .../pdf download route), persists it
// (mirroring VariationPackage's own generate-then-upload-then-record
// pattern), emails it with the user's reviewed/edited covering note
// attached, and marks the claim issued.
export async function POST(request: Request, context: { params: { projectId: string; claimId: string } }) {
  const userId = await requireUserId(request);
  const { projectId, claimId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const canAccessModule = await requireModuleAccess(projectId, userId, "payment_claims");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const claim = await prisma.paymentClaim.findFirst({ where: { id: claimId, projectId } });
  if (!claim) {
    return NextResponse.json({ error: "Payment claim not found." }, { status: 404 });
  }

  const payload = sendSchema.parse(await request.json());

  // Same contact-resolution rule as the Updates external-send flow — a
  // saved contact's email is always resolved server-side from the CURRENT
  // record, never trusted from the client, so it can't be spoofed to an
  // address the contact doesn't actually have on file. A one-off email
  // (no contactId) is used as typed.
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { mainContractorId: true } });
  const allRecipients = [...payload.to, ...payload.cc];
  const contactIds = allRecipients.map((r) => r.contactId).filter((id): id is string => Boolean(id));
  const contacts = contactIds.length
    ? await prisma.mainContractorContact.findMany({
        where: { id: { in: contactIds }, mainContractorId: project?.mainContractorId ?? undefined }
      })
    : [];
  const contactsById = new Map(contacts.map((c) => [c.id, c]));

  function resolve(recipients: typeof payload.to): { email: string }[] {
    const resolved: { email: string }[] = [];
    for (const recipient of recipients) {
      if (recipient.contactId) {
        const contact = contactsById.get(recipient.contactId);
        if (contact?.email) resolved.push({ email: contact.email });
      } else if (recipient.email) {
        resolved.push({ email: recipient.email });
      }
    }
    return resolved;
  }

  const to = resolve(payload.to);
  const cc = resolve(payload.cc);
  if (to.length === 0) {
    return NextResponse.json({ error: "Select at least one valid To recipient — one of the selected contacts may have no email on file." }, { status: 400 });
  }

  const pdfBytes = await generatePaymentClaimAppendixB1Pdf(projectId, claimId);
  const pdfKey = `projects/${projectId}/payment-claims/${claimId}/claim-${claim.claimNumber}-${Date.now()}.pdf`;
  const { storageKey } = await uploadToS3({ key: pdfKey, body: pdfBytes, contentType: "application/pdf" });

  let sendError: string | undefined;
  try {
    await sendPaymentClaimEmail({
      to,
      cc,
      subject: payload.subject,
      body: payload.body,
      attachments: [{ filename: `Payment Claim ${claim.claimNumber}.pdf`, content: pdfBytes, contentType: "application/pdf" }]
    });
  } catch (error) {
    sendError = error instanceof Error ? error.message : "Could not send the email.";
  }

  const updated = await prisma.paymentClaim.update({
    where: { id: claimId },
    data: {
      storageKey,
      // Only advance status/serviceDate on a real successful send — a
      // failed send (e.g. SendGrid misconfigured) shouldn't silently mark
      // a claim "issued" when the client never actually received it.
      ...(sendError ? {} : { status: "issued", serviceDate: claim.serviceDate ?? new Date() })
    }
  });

  return NextResponse.json({ claim: updated, sendError });
}
