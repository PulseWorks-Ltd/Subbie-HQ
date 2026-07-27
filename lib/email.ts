import sgMail from "@sendgrid/mail";

function getConfiguredSendGrid() {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  const templateId = process.env.SENDGRID_REPLY_TEMPLATE_ID;

  if (!apiKey || !fromEmail || !templateId) {
    return null;
  }

  sgMail.setApiKey(apiKey);
  return { fromEmail, templateId };
}

export async function sendReplyNotificationEmail(params: {
  to: string;
  authorName: string;
  projectName: string;
  updateBody: string;
  updateUrl: string;
}) {
  const config = getConfiguredSendGrid();
  if (!config) return;

  const baseUrl = process.env.AUTH_URL ?? "";

  await sgMail.send({
    to: params.to,
    from: { email: config.fromEmail, name: "Subbie HQ" },
    templateId: config.templateId,
    dynamicTemplateData: {
      author_name: params.authorName,
      project_name: params.projectName,
      update_body: params.updateBody,
      update_url: params.updateUrl,
      logo_url: `${baseUrl}/icons/icon-512.png`
    }
  });
}
