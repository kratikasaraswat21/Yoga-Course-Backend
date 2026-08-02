import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);

export async function RenderEmailTemplate(templateName, variables = {}) {
  const templatePath = path.join(currentDirectory, "templates", templateName);

  let html = await fs.readFile(templatePath, "utf8");

  for (const [key, value] of Object.entries(variables)) {
    html = html.replaceAll(`{{${key}}}`, String(value));
  }

  return html;
}

export const GetEmailTemplate = async (templateName, data) => {
  switch (templateName) {
    case "EMAIL_OTP_VERIFICATION":
      return await EmailOtpVerificationTemplate(data);
    case "EMAIL_PASSWORD_RESET":
      return await EmailPasswordResetTemplate(data);
  }
};

const EmailOtpVerificationTemplate = async (data) => {
  const { otp, name } = data;

  const subject = "Your OTP for Email Verification";

  const html = await RenderEmailTemplate("otp_email_verification.html", { EMAIL_OTP: otp, USER_NAME: name });
  return { subject, html };
};

const EmailPasswordResetTemplate = async (data) => {
  const { name, resetUrl } = data;
  const subject = "Reset your Yoga Course password";
  const html = await RenderEmailTemplate("password_reset.html", { USER_NAME: name, RESET_URL: resetUrl });

  return { subject, html };
};
