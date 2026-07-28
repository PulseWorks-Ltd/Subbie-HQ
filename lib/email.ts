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
