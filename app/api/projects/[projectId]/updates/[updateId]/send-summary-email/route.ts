import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModuleAccess, requireProjectAccess, requireUserId } from "@/lib/auth";
import { sendThreadSummaryEmailAndLog } from "@/lib/external-update";

const recipientSchema = z
  .object({ contactId: z.string().optional(), email: z.string().email().optional() })
  .refine((r) => r.contactId || r.email, { message: "Each recipient needs either a saved contact or an email address." });

const requestSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
  recipients: z.array(recipientSchema).min(1),
  attachmentIds: z.array(z.string()).default([])
});

// Sends the reviewed/edited thread-summary draft and logs it to
// Correspondence — can be called more than once on the same thread over
// time (e.g. the thread continues after an earlier summary was sent), each
// call producing its own Correspondence entry.
export async function POST(request: Request, context: { params: { projectId: string; updateId: string } }) {
  const userId = await requireUserId(request);
  const { projectId, updateId } = context.params;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasAccess = await requireProjectAccess(projectId, userId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const canAccessModule = await requireModuleAccess(projectId, userId, "updates");
  if (!canAccessModule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const update = await prisma.update.findFirst({ where: { id: updateId, projectId, parentId: null } });
  if (!update) {
    return NextResponse.json({ error: "Update thread not found." }, { status: 404 });
  }

  const payload = requestSchema.parse(await request.json());

  // Contact-based recipients are resolved to their CURRENT email server-side
  // — never trust a client-supplied email for a saved contact, same as the
  // update-composer's external send (app/api/projects/[projectId]/updates/route.ts).
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { mainContractorId: true } });
  const contactIds = payload.recipients.map((r) => r.contactId).filter((id): id is string => Boolean(id));
  const contacts = contactIds.length
    ? await prisma.mainContractorContact.findMany({
        where: { id: { in: contactIds }, mainContractorId: project?.mainContractorId ?? undefined }
      })
    : [];
  const contactsById = new Map(contacts.map((c) => [c.id, c]));

  const resolvedRecipients: { contactId?: string; email: string }[] = [];
  for (const recipient of payload.recipients) {
    if (recipient.contactId) {
      const contact = contactsById.get(recipient.contactId);
      if (!contact?.email) {
        return NextResponse.json({ error: "One of the selected contacts has no email on file." }, { status: 400 });
      }
      resolvedRecipients.push({ contactId: contact.id, email: contact.email });
    } else if (recipient.email) {
      resolvedRecipients.push({ email: recipient.email });
    }
  }

  const result = await sendThreadSummaryEmailAndLog({
    topLevelUpdateId: update.id,
    subject: payload.subject,
    body: payload.body,
    recipients: resolvedRecipients,
    attachmentIds: payload.attachmentIds
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }
  return NextResponse.json({ ok: true });
}
