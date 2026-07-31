import sgMail from "@sendgrid/mail";

function getConfiguredSendGrid() {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    return null;
  }

  sgMail.setApiKey(apiKey);
  return { fromEmail };
}

export async function sendReplyNotificationEmail(params: {
  to: string;
  authorName: string;
  projectName: string;
  updateBody: string;
  updateUrl: string;
}) {
  const config = getConfiguredSendGrid();
  const templateId = process.env.SENDGRID_REPLY_TEMPLATE_ID;
  if (!config || !templateId) return;

  const baseUrl = process.env.AUTH_URL ?? "";

  await sgMail.send({
    to: params.to,
    from: { email: config.fromEmail, name: "Subbie HQ" },
    templateId,
    dynamicTemplateData: {
      author_name: params.authorName,
      project_name: params.projectName,
      update_body: params.updateBody,
      update_url: params.updateUrl,
      logo_url: `${baseUrl}/icons/icon-512.png`
    }
  });
}

// Plain HTML rather than a SendGrid dynamic template — unlike the templates
// above (created ahead of time via SendGrid's dashboard), there's no
// SENDGRID_REMINDER_TEMPLATE_ID yet. If a branded template is wanted later,
// swap this for templateId/dynamicTemplateData the same way the functions
// above do.
export async function sendReminderEmail(params: {
  to: string;
  subject: string;
  headline: string;
  detail: string;
  projectName: string;
  itemUrl: string;
}) {
  const config = getConfiguredSendGrid();
  if (!config) return;

  await sgMail.send({
    to: params.to,
    from: { email: config.fromEmail, name: "Subbie HQ" },
    subject: params.subject,
    html: `
      <p>${params.headline}</p>
      <p>${params.detail} — <strong>${params.projectName}</strong></p>
      <p><a href="${params.itemUrl}">View in Subbie HQ</a></p>
    `
  });
}

// Unlike the fire-and-forget notification emails above (which silently
// no-op if SendGrid isn't configured, since they're a nice-to-have on top
// of an action that already succeeded), this is the actual user-facing send
// for an external Update — the user clicked "Send" and expects either real
// delivery or a clear error to retry (see Task 3.2's "handle send failures
// gracefully" requirement), so this throws rather than silently no-opping.
export async function sendExternalUpdateEmail(params: {
  to: { email: string; name?: string }[];
  subject: string;
  body: string;
  attachments: { filename: string; content: Uint8Array; contentType: string }[];
}) {
  const config = getConfiguredSendGrid();
  if (!config) {
    throw new Error("Email sending isn't configured — SENDGRID_API_KEY/SENDGRID_FROM_EMAIL are missing.");
  }

  const html = params.body
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br />")}</p>`)
    .join("\n");

  await sgMail.send({
    to: params.to,
    from: { email: config.fromEmail, name: "Subbie HQ" },
    subject: params.subject,
    text: params.body,
    html,
    attachments: params.attachments.map((attachment) => ({
      filename: attachment.filename,
      type: attachment.contentType,
      content: Buffer.from(attachment.content).toString("base64"),
      disposition: "attachment"
    }))
  });
}

// Plain HTML rather than a SendGrid dynamic template — same reasoning as
// sendReminderEmail: no SENDGRID_WELCOME_TEMPLATE_ID exists yet. Fire-and-
// forget like the other notification emails — a failed welcome email should
// never block account creation, which already succeeded by the time this
// is called (see app/api/auth/register/route.ts).
export async function sendWelcomeEmail(params: { to: string; name: string }) {
  const config = getConfiguredSendGrid();
  if (!config) return;

  const baseUrl = process.env.AUTH_URL ?? "";

  await sgMail.send({
    to: params.to,
    from: { email: config.fromEmail, name: "Subbie HQ" },
    subject: "Welcome to Subbie HQ",
    html: `
      <p><img src="${baseUrl}/icons/icon-512.png" alt="Subbie HQ" width="48" height="48" /></p>
      <p>Hi ${params.name},</p>
      <p>Welcome to Subbie HQ — your workspace for contract intelligence, payment claims, and project updates is ready.</p>
      <p><a href="${baseUrl}/projects">Create your first project</a> to get started, or <a href="${baseUrl}/get-app">install the mobile app</a> to post site updates on the go.</p>
    `
  });
}

// Fire-and-forget, same as sendWelcomeEmail/sendReminderEmail — silently
// no-ops if SendGrid isn't configured. Deliberately never awaited by its
// caller (see lib/password-reset.ts's requestPasswordReset) so its network
// latency can never create a timing difference between "email matched a
// real account" and "email didn't match anything," which would otherwise
// leak account existence even though the HTTP response text is identical.
export async function sendPasswordResetEmail(params: { to: string; name: string; resetUrl: string }) {
  const config = getConfiguredSendGrid();
  if (!config) return;

  const baseUrl = process.env.AUTH_URL ?? "";

  await sgMail.send({
    to: params.to,
    from: { email: config.fromEmail, name: "Subbie HQ" },
    subject: "Reset your Subbie HQ password",
    html: `
      <p><img src="${baseUrl}/icons/icon-512.png" alt="Subbie HQ" width="48" height="48" /></p>
      <p>Hi ${params.name},</p>
      <p>We received a request to reset your Subbie HQ password. This link expires in 1 hour.</p>
      <p><a href="${params.resetUrl}">Reset your password</a></p>
      <p>If you didn't request this, you can safely ignore this email — your password won't be changed.</p>
    `
  });
}

export async function sendOrganisationInviteEmail(params: {
  to: string;
  organisationName: string;
  inviterName: string;
  title: string | null;
  inviteUrl: string;
}) {
  const config = getConfiguredSendGrid();
  const templateId = process.env.SENDGRID_INVITE_TEMPLATE_ID;
  if (!config || !templateId) return;

  const baseUrl = process.env.AUTH_URL ?? "";

  await sgMail.send({
    to: params.to,
    from: { email: config.fromEmail, name: "Subbie HQ" },
    templateId,
    dynamicTemplateData: {
      organisation_name: params.organisationName,
      inviter_name: params.inviterName,
      title: params.title ?? "",
      invite_url: params.inviteUrl,
      logo_url: `${baseUrl}/icons/icon-512.png`
    }
  });
}
