import crypto from "crypto";
import { prisma } from "./prisma";
import { sendExternalActionRequestEmail } from "./email";
import { formatUserName } from "./user-display";
import { EXTERNAL_ACTION_TYPE_LABELS } from "./external-action-types";
import type { ExternalActionChoice, ExternalActionType } from "@prisma/client";

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, per the task brief

// Same SHA-256-of-a-32-byte-random-value pattern as
// lib/password-reset.ts's requestPasswordReset — only the hash is ever
// persisted, so this table can never itself leak a usable token.
function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

const GENERIC_INVALID_MESSAGE = "This link isn't valid. Please contact the sender for a new one.";

export type ExternalActionPublicContext = {
  type: ExternalActionType;
  message: string | null;
  status: "pending" | "responded" | "expired";
  expiresAt: Date;
  recipientName: string | null;
  senderName: string;
  source:
    | { kind: "variation_item"; reference: string; title: string; description: string | null; isSiteInstruction: boolean }
    | { kind: "day_works_sheet"; fileName: string; createdAt: Date; itemReference: string; itemTitle: string };
  existingResponse: {
    choice: ExternalActionChoice | null;
    name: string | null;
    comment: string | null;
    respondedAt: Date;
  } | null;
};

// Sends the request email FIRST, only persisting the ExternalAction (and
// its token) once the send actually succeeds — there's no other reason for
// this row to exist without ever having been sent, so unlike other
// "external" flows in this app (where the source row is created up front
// and sending is best-effort on top of it), a failed send here should
// never leave a dangling, never-delivered token behind.
export async function createAndSendExternalAction(params: {
  projectId: string;
  variationItemId?: string;
  dayWorksSheetId?: string;
  type: ExternalActionType;
  message?: string;
  recipient: { contactId?: string; email?: string };
  sentByUserId: string;
  baseUrl: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (Boolean(params.variationItemId) === Boolean(params.dayWorksSheetId)) {
    return { ok: false, error: "Exactly one of a Variation/SI or a Day Works Sheet must be set." };
  }

  const [sender, project] = await Promise.all([
    prisma.user.findUnique({ where: { id: params.sentByUserId }, select: { firstName: true, lastName: true, email: true } }),
    prisma.project.findUnique({ where: { id: params.projectId }, select: { name: true, mainContractorId: true } })
  ]);
  const senderName = (sender && formatUserName(sender)) ?? sender?.email ?? "Subbie HQ";

  let recipientEmail: string;
  let recipientName: string | null = null;
  let mainContractorContactId: string | undefined;

  // Same "resolve a saved contact to its CURRENT email server-side" rule as
  // External Updates (lib/external-update.ts) — never trust a client-
  // supplied email for a saved contact.
  if (params.recipient.contactId) {
    const contact = await prisma.mainContractorContact.findFirst({
      where: { id: params.recipient.contactId, mainContractorId: project?.mainContractorId ?? undefined }
    });
    if (!contact?.email) {
      return { ok: false, error: "This contact has no email on file." };
    }
    recipientEmail = contact.email;
    recipientName = contact.name;
    mainContractorContactId = contact.id;
  } else if (params.recipient.email) {
    recipientEmail = params.recipient.email;
  } else {
    return { ok: false, error: "Select a contact or enter an email address." };
  }

  let variationItemId = params.variationItemId;
  let sourceLabel: string;
  if (params.dayWorksSheetId) {
    const sheet = await prisma.dayWorksSheet.findFirst({
      where: { id: params.dayWorksSheetId, variationItem: { projectId: params.projectId } },
      include: { variationItem: { select: { id: true, reference: true, title: true } } }
    });
    if (!sheet) {
      return { ok: false, error: "Day Works Sheet not found." };
    }
    variationItemId = sheet.variationItemId;
    sourceLabel = `Day Works Sheet — ${sheet.variationItem.reference}`;
  } else {
    const item = await prisma.variationItem.findFirst({ where: { id: variationItemId, projectId: params.projectId } });
    if (!item) {
      return { ok: false, error: "Variation/Site Instruction not found." };
    }
    sourceLabel = `${item.reference} — ${item.title}`;
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const responseUrl = `${params.baseUrl}/respond/${rawToken}`;
  const typeLabel = EXTERNAL_ACTION_TYPE_LABELS[params.type];

  try {
    await sendExternalActionRequestEmail({
      to: recipientEmail,
      recipientName,
      senderName,
      projectName: project?.name ?? "the project",
      sourceLabel,
      typeLabel,
      message: params.message,
      responseUrl
    });
  } catch (error) {
    console.error("Failed to send External Action request email:", error);
    return { ok: false, error: "Could not send this request — check your connection and try again." };
  }

  const externalAction = await prisma.externalAction.create({
    data: {
      projectId: params.projectId,
      variationItemId,
      dayWorksSheetId: params.dayWorksSheetId,
      type: params.type,
      message: params.message,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      mainContractorContactId,
      recipientEmail,
      recipientName,
      sentByUserId: params.sentByUserId
    }
  });

  // Logged immediately at send time (Task 4.2) — updated in place once a
  // response comes in (see submitExternalActionResponse) so the whole
  // request-and-response exchange is ONE Correspondence entry.
  await prisma.correspondence.create({
    data: {
      projectId: params.projectId,
      variationItemId,
      title: `${typeLabel} requested from ${recipientName ?? recipientEmail}`,
      source: "external_action",
      bodyText: params.message ?? `${typeLabel} requested for ${sourceLabel}.`,
      category: typeLabel,
      sourceExternalActionId: externalAction.id
    }
  });

  return { ok: true };
}

// Resolves a raw token for the PUBLIC response page — deliberately returns
// only the specific record's own reference/title/description (or sheet
// filename), never the project id, other items, or anything else from the
// organisation (Task 3.3). Lazily flips a stale "pending" row to "expired"
// on read, so the source record's own detail page (which reads `status`
// directly, not this function) stays accurate without needing a cron sweep.
export async function getExternalActionForToken(
  rawToken: string
): Promise<{ ok: true; context: ExternalActionPublicContext } | { ok: false; error: string }> {
  const action = await prisma.externalAction.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: {
      variationItem: { select: { reference: true, title: true, description: true, type: true } },
      dayWorksSheet: {
        select: { fileName: true, createdAt: true, variationItem: { select: { reference: true, title: true } } }
      },
      sentByUser: { select: { firstName: true, lastName: true, email: true } }
    }
  });

  if (!action) {
    return { ok: false, error: GENERIC_INVALID_MESSAGE };
  }

  let status = action.status;
  if (status === "pending" && action.expiresAt < new Date()) {
    status = "expired";
    await prisma.externalAction.update({ where: { id: action.id }, data: { status: "expired" } });
  }

  const senderName = (action.sentByUser && formatUserName(action.sentByUser)) ?? action.sentByUser.email;

  if (status === "expired") {
    return { ok: false, error: `This link has expired. Please contact ${senderName} for a new one.` };
  }

  const source = action.dayWorksSheet
    ? ({
        kind: "day_works_sheet" as const,
        fileName: action.dayWorksSheet.fileName,
        createdAt: action.dayWorksSheet.createdAt,
        itemReference: action.dayWorksSheet.variationItem.reference,
        itemTitle: action.dayWorksSheet.variationItem.title
      } as const)
    : action.variationItem
      ? ({
          kind: "variation_item" as const,
          reference: action.variationItem.reference,
          title: action.variationItem.title,
          description: action.variationItem.description,
          isSiteInstruction: action.variationItem.type === "site_instruction"
        } as const)
      : null;

  if (!source) {
    // Shouldn't happen (exactly one is always set at creation), but never
    // surface an internal inconsistency as a raw error to a public visitor.
    return { ok: false, error: GENERIC_INVALID_MESSAGE };
  }

  return {
    ok: true,
    context: {
      type: action.type,
      message: action.message,
      status,
      expiresAt: action.expiresAt,
      recipientName: action.recipientName,
      senderName,
      source,
      existingResponse:
        status === "responded" && action.respondedAt
          ? {
              choice: action.responseChoice,
              name: action.responseName,
              comment: action.responseComment,
              respondedAt: action.respondedAt
            }
          : null
    }
  };
}

export type SubmitExternalActionResponseInput = {
  choice?: "approved" | "rejected";
  name: string;
  comment?: string;
};

export async function submitExternalActionResponse(
  rawToken: string,
  input: SubmitExternalActionResponseInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const action = await prisma.externalAction.findUnique({ where: { tokenHash: hashToken(rawToken) } });
  if (!action) {
    return { ok: false, error: GENERIC_INVALID_MESSAGE };
  }
  if (action.status === "responded") {
    return { ok: false, error: "This link has already been used." };
  }
  if (action.expiresAt < new Date()) {
    await prisma.externalAction.update({ where: { id: action.id }, data: { status: "expired" } });
    return { ok: false, error: "This link has expired. Please contact the sender for a new one." };
  }

  if (!input.name.trim()) {
    return { ok: false, error: "Enter your name." };
  }

  let choice: ExternalActionChoice | null = null;
  if (action.type === "approve") {
    if (input.choice !== "approved" && input.choice !== "rejected") {
      return { ok: false, error: "Choose Approve or Reject." };
    }
    choice = input.choice;
  } else if (action.type === "reject") {
    if (!input.comment?.trim()) {
      return { ok: false, error: "Enter a reason." };
    }
    choice = "rejected";
  } else if (action.type === "comment") {
    if (!input.comment?.trim()) {
      return { ok: false, error: "Enter a comment." };
    }
  }

  const respondedAt = new Date();
  await prisma.externalAction.update({
    where: { id: action.id },
    data: {
      status: "responded",
      responseChoice: choice,
      responseName: input.name.trim(),
      responseComment: input.comment?.trim() || undefined,
      respondedAt
    }
  });

  const typeLabel = EXTERNAL_ACTION_TYPE_LABELS[action.type];
  const summary = [
    `— ${typeLabel} response from ${input.name.trim()} on ${respondedAt.toLocaleDateString("en-NZ")}`,
    choice ? `Selected: ${choice === "approved" ? "Approved" : "Rejected"}` : null,
    input.comment?.trim() ? `Comment: ${input.comment.trim()}` : null
  ]
    .filter(Boolean)
    .join("\n");

  const correspondence = await prisma.correspondence.findUnique({ where: { sourceExternalActionId: action.id } });
  if (correspondence) {
    await prisma.correspondence.update({
      where: { id: correspondence.id },
      data: { bodyText: `${correspondence.bodyText ?? ""}\n\n${summary}`.trim() }
    });
  }

  return { ok: true };
}
