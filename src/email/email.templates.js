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

    case "ADMIN_EMAIL_OTP_VERIFICATION":
      return await AdminLoginOtpVerificationTemplate(data);

    case "EMAIL_COURSE_ACCESS_REVOKED":
      return await CourseAccessRevokedTemplate(data);

    case "EMAIL_COURSE_ACCESS_RESTORED":
      return await CourseAccessRestoredTemplate(data);
  }
};

const CourseAccessRevokedTemplate = async (data) => {
  const { name, courseTitle, reason } = data;
  const subject = `Your access to ${courseTitle} has been revoked`;
  const html = await RenderEmailTemplate("course_access_revoked.html", {
    USER_NAME: name,
    COURSE_TITLE: courseTitle,
    REVOCATION_REASON: reason,
  });

  return { subject, html };
};

const CourseAccessRestoredTemplate = async (data) => {
  const { name, courseTitle } = data;
  const subject = `Congratulations! Your access to ${courseTitle} is restored`;
  const html = await RenderEmailTemplate("course_access_restored.html", {
    USER_NAME: name,
    COURSE_TITLE: courseTitle,
  });

  return { subject, html };
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

const AdminLoginOtpVerificationTemplate = async (data) => {
  const { name, otp } = data;
  const subject = "Here Is You Otp For Admin Login";

  const html = await RenderEmailTemplate("admin_otp_email_verification.html", {
    ADMIN_LOGIN_OTP: otp,
    ADMIN_NAME: name,
  });

  return { subject, html };
};
