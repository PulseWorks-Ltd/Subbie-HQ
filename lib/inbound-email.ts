import { prisma } from "./prisma";
import { classifyInboundEmail, extractVariationItemFromText } from "./grok";
import { getSignedDownloadUrl } from "./s3";
import { extractPdfPagesWithOcrFallback } from "./pdf-text-extraction";

// Keeps a single pathological attachment (a huge multi-hundred-page PDF)
// from blowing out the classification prompt — inbound-email attachments
// (Site Instructions, variation notices) are realistically a handful of
// pages, so this is a generous safety cap, not a real-world limit.
const MAX_ATTACHMENT_TEXT_CHARS = 12_000;

// Each Organisation gets its own address via a "+" tag on one shared
// SendGrid Inbound Parse domain (see docs/staging.md / .env.example for the
// required MX record) — inbox+<organisationId>@<INBOUND_EMAIL_DOMAIN>.
// SendGrid routes ALL mail for that domain to one webhook regardless of the
// local part, so the webhook resolves the organisation itself by parsing
// this tag back out of the "to" header (see resolveOrganisationIdFromAddress).
export function getInboundEmailAddress(organisationId: string): string | null {
  const domain = process.env.INBOUND_EMAIL_DOMAIN;
  if (!domain) return null;
  return `inbox+${organisationId}@${domain}`;
}

export function resolveOrganisationIdFromAddress(toHeader: string): string | null {
  const match = toHeader.match(/inbox\+([a-zA-Z0-9]+)@/);
  return match ? match[1] : null;
}

function extractEmailAddress(raw: string): string {
  const angleMatch = raw.match(/<([^>]+)>/);
  return (angleMatch ? angleMatch[1] : raw).trim().toLowerCase();
}

// SendGrid's "to"/"cc" fields are a single comma-separated header string,
// each entry optionally "Display Name <email@x.com>" — same shape as an
// email client's own To/Cc line.
export function parseAddressList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => extractEmailAddress(part))
    .filter((email) => email.includes("@"));
}

// Files a reviewed InboundEmail into the target project's Correspondence —
// same create-row-then-transaction pattern as sendExternalUpdateAndLog
// (lib/external-update.ts): the source row and the new Correspondence row
// are updated/created together so they can never end up out of sync.
//
// createVariationItem is mutually exclusive with variationItemId — either
// link to an already-existing item, or (once the reviewer has confirmed the
// AI-extracted details, see extractVariationItemDetailsFromEmail) create a
// brand-new one from this email. When creating, the email's first attachment
// (if any) becomes the item's source file, same as a manual document upload
// — the existing S3 object is reused by storageKey, not copied.
//
// createQaRecord (Task 4) is a separate, simpler destination: no AI
// extraction, just the reviewer's own stage label and an optional link to
// an existing Variation/SI (project-level if omitted) — same
// reuse-by-storageKey treatment of the email's first attachment as
// createVariationItem above.
export async function fileInboundEmail(params: {
  emailId: string;
  projectId: string;
  category: string;
  variationItemId?: string;
  createVariationItem?: {
    type: "variation" | "site_instruction";
    reference: string;
    title: string;
    description?: string;
    notifiedAt?: string;
    dueAt?: string;
  };
  createQaRecord?: {
    stage: string;
    variationItemId?: string;
  };
  reviewerUserId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = await prisma.inboundEmail.findUnique({ where: { id: params.emailId }, include: { attachments: true } });
  if (!email) {
    return { ok: false, error: "Email not found." };
  }
  if (email.status !== "pending_review") {
    return { ok: false, error: "This email has already been reviewed." };
  }

  await prisma.$transaction(async (tx) => {
    let variationItemId = params.variationItemId;
    let qaRecordId: string | undefined;

    if (params.createVariationItem) {
      const sourceAttachment = email.attachments[0];
      const created = await tx.variationItem.create({
        data: {
          projectId: params.projectId,
          type: params.createVariationItem.type,
          reference: params.createVariationItem.reference,
          title: params.createVariationItem.title,
          description: params.createVariationItem.description,
          notifiedAt: params.createVariationItem.notifiedAt ? new Date(params.createVariationItem.notifiedAt) : undefined,
          dueAt: params.createVariationItem.dueAt ? new Date(params.createVariationItem.dueAt) : undefined,
          fileName: sourceAttachment?.fileName,
          storageKey: sourceAttachment?.storageKey
        }
      });
      variationItemId = created.id;
    }

    if (params.createQaRecord) {
      const created = await tx.qARecord.create({
        data: {
          projectId: params.projectId,
          variationItemId: params.createQaRecord.variationItemId || null,
          stage: params.createQaRecord.stage,
          notes: email.body
        }
      });
      // Every attachment (not just the first) becomes its own
      // QARecordAttachment, reusing the existing S3 object by storageKey —
      // not copied, same as createVariationItem above.
      for (const attachment of email.attachments) {
        await tx.qARecordAttachment.create({
          data: {
            qaRecordId: created.id,
            fileName: attachment.fileName,
            storageKey: attachment.storageKey,
            contentType: attachment.contentType
          }
        });
      }
      qaRecordId = created.id;
      variationItemId = params.createQaRecord.variationItemId || variationItemId;
    }

    await tx.inboundEmail.update({
      where: { id: params.emailId },
      data: {
        projectId: params.projectId,
        status: "filed",
        reviewedByUserId: params.reviewerUserId,
        reviewedAt: new Date()
      }
    });
    await tx.correspondence.create({
      data: {
        projectId: params.projectId,
        variationItemId,
        qaRecordId,
        title: email.subject,
        source: "inbound_email",
        bodyText: email.body,
        category: params.category,
        inboundEmailId: email.id
      }
    });
  });

  return { ok: true };
}

// No existing helper returns "all projects in this org + their Main
// Contractor's contacts" (checked — every other place in the app queries
// this fresh), so this is written directly against what classifyInboundEmail
// needs: candidate projects, each with known contact emails (a sender/CC
// match is a strong signal) and open Variation/Site Instruction references.
async function getCandidateProjectsForClassification(organisationId: string) {
  const projects = await prisma.project.findMany({
    where: { organisationId },
    select: {
      id: true,
      name: true,
      mainContractor: { select: { name: true, contacts: { select: { email: true } } } },
      variationItems: {
        where: { status: { in: ["draft", "open"] } },
        select: { id: true, reference: true, title: true }
      }
    }
  });

  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    mainContractorName: project.mainContractor?.name ?? null,
    contactEmails: (project.mainContractor?.contacts ?? [])
      .map((contact) => contact.email)
      .filter((email): email is string => Boolean(email)),
    openVariationItems: project.variationItems
  }));
}

// PDF-only (matches the existing extractPdfPagesWithOcrFallback tool this
// reuses, see lib/pdf-text-extraction.ts) — a non-PDF attachment (image,
// Word doc) still gets classified from filename + email context alone,
// same as before this fix, rather than failing the whole email over one
// attachment type this doesn't yet handle.
async function extractAttachmentText(attachment: { storageKey: string; contentType: string }): Promise<string | null> {
  if (attachment.contentType !== "application/pdf") return null;

  try {
    const signedUrl = await getSignedDownloadUrl(attachment.storageKey);
    const response = await fetch(signedUrl);
    const buffer = new Uint8Array(await response.arrayBuffer());
    const pages = await extractPdfPagesWithOcrFallback(buffer);
    const text = pages.map((p) => p.text).join("\n\n");
    return text.slice(0, MAX_ATTACHMENT_TEXT_CHARS);
  } catch (error) {
    // A genuinely unreadable PDF (UnreadablePdfError) or any other
    // extraction failure shouldn't kill the whole classification — just
    // fall back to filename-only for this one attachment, same as a
    // non-PDF file.
    console.error(`Could not extract text from attachment ${attachment.storageKey}:`, error);
    return null;
  }
}

// Combines an email's body with any successfully-extracted PDF attachment
// text into one block, for anything that needs to reason over "everything
// this email says" (classification, and now structured Variation/Site
// Instruction detail extraction).
async function getCombinedEmailText(email: { body: string; attachments: { storageKey: string; contentType: string }[] }) {
  const attachmentTexts = await Promise.all(email.attachments.map(extractAttachmentText));
  const extractedParts = attachmentTexts.filter((text): text is string => Boolean(text));
  return extractedParts.length ? `${email.body}\n\n--- Attachment content ---\n${extractedParts.join("\n\n")}` : email.body;
}

// Preview-only (nothing persisted) — reuses the SAME extractVariationItemFromText
// used for manually-uploaded documents (see variation-items/parse/route.ts),
// just fed this email's combined body+attachment text instead of a freshly
// uploaded PDF's. Called once a reviewer picks "create a new item" for a
// Variation/Site Instruction-classified email; they review/edit the result
// before it's ever saved (see fileInboundEmail's createVariationItem).
export async function extractVariationItemDetailsFromEmail(
  emailId: string,
  itemType: "variation" | "site_instruction",
  triggeredByUserId?: string
) {
  const email = await prisma.inboundEmail.findUnique({ where: { id: emailId }, include: { attachments: true } });
  if (!email) {
    throw new Error("Email not found.");
  }

  const combinedText = await getCombinedEmailText(email);
  return extractVariationItemFromText(combinedText, itemType, {
    organisationId: email.organisationId,
    userId: triggeredByUserId ?? null,
    contextRef: emailId
  });
}

// Runs Grok classification for a just-received InboundEmail and writes the
// suggested* fields back — deliberately NOT awaited by the webhook route
// (see app/api/webhooks/inbound-email/route.ts) so SendGrid gets a fast 200
// regardless of how long the AI call takes. A failure here now persists a
// visible classificationError on the row (see Task 1.1) instead of silently
// leaving it indistinguishable from a genuinely low-confidence "not
// detected" result — the two are different situations and a reviewer
// should be able to tell them apart.
export async function classifyAndSuggest(emailId: string, triggeredByUserId?: string): Promise<void> {
  try {
    const email = await prisma.inboundEmail.findUnique({ where: { id: emailId }, include: { attachments: true } });
    if (!email) return;

    const [candidateProjects, attachments] = await Promise.all([
      getCandidateProjectsForClassification(email.organisationId),
      Promise.all(
        email.attachments.map(async (attachment) => ({
          fileName: attachment.fileName,
          extractedText: await extractAttachmentText(attachment)
        }))
      )
    ]);

    const result = await classifyInboundEmail(
      {
        sender: email.sender,
        ccAddresses: email.ccAddresses,
        subject: email.subject,
        body: email.body,
        attachments,
        candidateProjects
      },
      { organisationId: email.organisationId, userId: triggeredByUserId ?? null, contextRef: emailId }
    );

    // Grok is told to only pick ids from the candidate list, but never trust
    // a model's output blindly — re-validate before persisting a suggestion.
    const matchedProject = result.projectId ? candidateProjects.find((p) => p.id === result.projectId) : undefined;
    const matchedVariationItem =
      matchedProject && result.variationItemId
        ? matchedProject.openVariationItems.find((item) => item.id === result.variationItemId)
        : undefined;

    await prisma.inboundEmail.update({
      where: { id: emailId },
      data: {
        suggestedProjectId: matchedProject?.id,
        suggestedProjectConfidence: matchedProject ? result.projectConfidence : null,
        suggestedType: result.suggestedType,
        suggestedVariationItemId: matchedVariationItem?.id,
        aiSummary: result.summary,
        classificationError: null
      }
    });
  } catch (error) {
    console.error(`Failed to classify inbound email ${emailId}:`, error);
    const message = error instanceof Error ? error.message : "Unknown error";
    await prisma.inboundEmail
      .update({ where: { id: emailId }, data: { classificationError: message.slice(0, 500) } })
      .catch(() => {});
  }
}

// Safety net for classifyAndSuggest's fire-and-forget invocation from the
// webhook (see app/api/webhooks/inbound-email/route.ts): that call is
// deliberately not awaited so SendGrid gets a fast response, but that means
// nothing guarantees it actually finishes — e.g. if a Railway deploy recycles
// the container mid-flight, the in-flight promise is simply killed with no
// exception ever reaching classifyAndSuggest's own try/catch, so no error is
// ever recorded either. Any row still showing no summary AND no error a
// couple of minutes after being received is indistinguishable from "never
// ran" and safe to retry — a genuinely-completed run always sets one or the
// other. The 2-minute grace period avoids racing the webhook's own in-flight
// attempt for a brand new email. Driven by a short-interval Railway Cron Job
// (see app/api/cron/classify-inbound-emails/route.ts), same
// cron-hitting-HTTP-endpoint pattern as lib/reminders.ts.
export async function sweepUnclassifiedInboundEmails(): Promise<{ found: number; ids: string[] }> {
  const cutoff = new Date(Date.now() - 2 * 60 * 1000);
  const stuck = await prisma.inboundEmail.findMany({
    where: {
      status: "pending_review",
      aiSummary: null,
      classificationError: null,
      receivedAt: { lt: cutoff }
    },
    select: { id: true }
  });

  for (const { id } of stuck) {
    await classifyAndSuggest(id);
  }

  return { found: stuck.length, ids: stuck.map((email) => email.id) };
}

// Dismissed emails are kept, not deleted — a lightweight record in case an
// email needs revisiting later (e.g. "actually that WAS relevant").
export async function dismissInboundEmail(
  emailId: string,
  reviewerUserId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = await prisma.inboundEmail.findUnique({ where: { id: emailId } });
  if (!email) {
    return { ok: false, error: "Email not found." };
  }
  if (email.status !== "pending_review") {
    return { ok: false, error: "This email has already been reviewed." };
  }

  await prisma.inboundEmail.update({
    where: { id: emailId },
    data: { status: "dismissed", dismissedAt: new Date(), reviewedByUserId: reviewerUserId, reviewedAt: new Date() }
  });

  return { ok: true };
}
