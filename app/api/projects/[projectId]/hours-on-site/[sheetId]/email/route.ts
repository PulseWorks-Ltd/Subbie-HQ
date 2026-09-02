import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, requireUserId } from "@/lib/auth";
import { getSheetWithDetail } from "@/lib/hours-on-site";
import { generateHoursOnSitePdf, paramsFromSheet } from "@/lib/hours-on-site-pdf";
import { sendExternalUpdateEmail } from "@/lib/email";
import { formatUserName } from "@/lib/user-display";

const emailSchema = z.object({
  contactId: z.string().optional(),
  email: z.string().email().optional()
});

export async function POST(request: Request, context: { params: { projectId: string; sheetId: string } }) {
  const userId = await requireUserId(request);
  const { projectId, sheetId } = context.params;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireProjectAccess(projectId, userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = emailSchema.parse(await request.json());
  if (!payload.contactId && !payload.email) {
    return NextResponse.json({ error: "Select a contact or enter an email address." }, { status: 400 });
  }

  const [sheet, project, sender] = await Promise.all([
    getSheetWithDetail(sheetId),
    prisma.project.findUnique({ where: { id: projectId }, select: { name: true, mainContractorId: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, email: true } })
  ]);
  if (!sheet || sheet.projectId !== projectId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Same "resolve a saved contact to its CURRENT email server-side" rule
  // as every other saved-contact recipient in this app — never trust a
  // client-supplied email for a saved contact.
  let recipientEmail: string;
  let recipientName: string | undefined;
  if (payload.contactId) {
    const contact = await prisma.mainContractorContact.findFirst({
      where: { id: payload.contactId, mainContractorId: project?.mainContractorId ?? undefined }
    });
    if (!contact?.email) return NextResponse.json({ error: "This contact has no email on file." }, { status: 400 });
    recipientEmail = contact.email;
    recipientName = contact.name;
  } else {
    recipientEmail = payload.email!;
  }

  const pdfBytes = await generateHoursOnSitePdf(paramsFromSheet(sheet));
  const senderName = (sender && formatUserName(sender)) ?? sender?.email ?? "Subbie HQ";
  const dateLabel = sheet.startedAt.toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });

  try {
    await sendExternalUpdateEmail({
      to: [{ email: recipientEmail, name: recipientName }],
      subject: `Hours on Site — ${sheet.project.name} — ${dateLabel}`,
      body: `${senderName} has sent you the Hours on Site sheet for ${sheet.project.name} (${dateLabel}). See the attached PDF for the full record.`,
      attachments: [
        {
          filename: `Hours on Site - ${sheet.project.name} - ${sheet.startedAt.toISOString().slice(0, 10)}.pdf`,
          content: pdfBytes,
          contentType: "application/pdf"
        }
      ]
    });
  } catch (error) {
    console.error("Failed to email Hours on Site sheet:", error);
    return NextResponse.json({ error: "Could not send this email — check your connection and try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
