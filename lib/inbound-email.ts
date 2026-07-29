import { prisma } from "./prisma";
import { classifyInboundEmail } from "./grok";

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
export async function fileInboundEmail(params: {
  emailId: string;
  projectId: string;
  category: string;
  variationItemId?: string;
  reviewerUserId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = await prisma.inboundEmail.findUnique({ where: { id: params.emailId } });
  if (!email) {
    return { ok: false, error: "Email not found." };
  }
  if (email.status !== "pending_review") {
    return { ok: false, error: "This email has already been reviewed." };
  }

  await prisma.$transaction([
    prisma.inboundEmail.update({
      where: { id: params.emailId },
      data: {
        projectId: params.projectId,
        status: "filed",
        reviewedByUserId: params.reviewerUserId,
        reviewedAt: new Date()
      }
    }),
    prisma.correspondence.create({
      data: {
        projectId: params.projectId,
        variationItemId: params.variationItemId,
        title: email.subject,
        source: "inbound_email",
        bodyText: email.body,
        category: params.category,
        inboundEmailId: email.id
      }
    })
  ]);

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

// Runs Grok classification for a just-received InboundEmail and writes the
// suggested* fields back — deliberately NOT awaited by the webhook route
// (see app/api/webhooks/inbound-email/route.ts) so SendGrid gets a fast 200
// regardless of how long the AI call takes; any failure here just leaves the
// suggestions blank, which is the same safe "not detected" state a low-
// confidence result would produce anyway (see Incoming Emails Task 2).
export async function classifyAndSuggest(emailId: string): Promise<void> {
  try {
    const email = await prisma.inboundEmail.findUnique({ where: { id: emailId }, include: { attachments: true } });
    if (!email) return;

    const candidateProjects = await getCandidateProjectsForClassification(email.organisationId);

    const result = await classifyInboundEmail({
      sender: email.sender,
      ccAddresses: email.ccAddresses,
      subject: email.subject,
      body: email.body,
      attachmentNames: email.attachments.map((a) => a.fileName),
      candidateProjects
    });

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
        aiSummary: result.summary
      }
    });
  } catch (error) {
    console.error(`Failed to classify inbound email ${emailId}:`, error);
  }
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
