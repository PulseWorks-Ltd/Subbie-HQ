import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { sendQaDocumentEmail } from "@/lib/email";
import { downloadFromS3 } from "@/lib/s3";

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

// Unlike Payment Claim's send route, this does NOT regenerate the PDF — a
// QaDocument is an immutable snapshot of exactly the records/order chosen
// at generation time, so sending it re-downloads the SAME stored bytes
// rather than producing a new one.
export async function POST(request: Request, context: { params: { projectId: string; qaDocumentId: string } }) {
  const userId = await requireUserId(request);
  const { projectId, qaDocumentId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const canAccessModule = await requireModuleAccess(projectId, userId, "quality_assurance");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const qaDocument = await prisma.qaDocument.findFirst({ where: { id: qaDocumentId, projectId } });
  if (!qaDocument) {
    return NextResponse.json({ error: "QA Document not found." }, { status: 404 });
  }

  const payload = sendSchema.parse(await request.json());

  // Same contact-resolution rule as every other send flow this session —
  // a saved contact's email is always resolved server-side from the
  // CURRENT record, never trusted from the client.
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
    return NextResponse.json(
      { error: "Select at least one valid To recipient — one of the selected contacts may have no email on file." },
      { status: 400 }
    );
  }

  const pdfBytes = await downloadFromS3(qaDocument.storageKey);

  let sendError: string | undefined;
  try {
    await sendQaDocumentEmail({
      to,
      cc,
      subject: payload.subject,
      body: payload.body,
      attachments: [{ filename: qaDocument.fileName, content: pdfBytes, contentType: "application/pdf" }]
    });
  } catch (error) {
    sendError = error instanceof Error ? error.message : "Could not send the email.";
  }

  return NextResponse.json({ ok: !sendError, sendError });
}
