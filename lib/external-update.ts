import { prisma } from "./prisma";
import { getSignedDownloadUrl } from "./s3";
import { sendExternalUpdateEmail } from "./email";

// Shared by the update-creation route (sends immediately after creating)
// and the retry-send route (app/api/projects/[projectId]/updates/[updateId]/send)
// — an external update's recipients/subject/body are already persisted by
// the time this runs, so a failed send never loses the drafted content;
// the same Update row is just retried.
export async function sendExternalUpdateAndLog(updateId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const update = await prisma.update.findUnique({
    where: { id: updateId },
    include: { recipients: true, attachments: true }
  });

  if (!update) {
    return { ok: false, error: "Update not found." };
  }
  if (!update.isExternal || !update.externalSubject || !update.externalBody) {
    return { ok: false, error: "This update isn't ready to send." };
  }
  if (update.recipients.length === 0) {
    return { ok: false, error: "No recipients to send to." };
  }
  if (update.externalSentAt) {
    return { ok: true };
  }

  try {
    const attachments = await Promise.all(
      update.attachments.map(async (attachment) => {
        const signedUrl = await getSignedDownloadUrl(attachment.storageKey);
        const response = await fetch(signedUrl);
        const content = new Uint8Array(await response.arrayBuffer());
        return { filename: attachment.fileName, content, contentType: attachment.contentType };
      })
    );

    await sendExternalUpdateEmail({
      to: update.recipients.map((recipient) => ({ email: recipient.email })),
      subject: update.externalSubject,
      body: update.externalBody,
      attachments
    });

    await prisma.$transaction([
      prisma.update.update({ where: { id: updateId }, data: { externalSentAt: new Date() } }),
      prisma.correspondence.create({
        data: {
          projectId: update.projectId,
          title: update.externalSubject,
          source: "external_update",
          bodyText: update.externalBody,
          sourceUpdateId: update.id
        }
      })
    ]);

    return { ok: true };
  } catch (error) {
    console.error(`Failed to send external update ${updateId}:`, error);
    return { ok: false, error: "Could not send this email — check your connection and try again." };
  }
}
