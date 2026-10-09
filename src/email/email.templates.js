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

    case "EMAIL_COURSE_PURCHASED":
      return await CoursePurchasedTemplate(data);

    case "EMAIL_COURSE_PURCHASED_PRELAUNCH":
      return await CoursePurchasedPrelaunchTemplate(data);

    case "EMAIL_COURSE_LIVE":
      return await CourseLiveTemplate(data);
  }
};

// Values in the purchase and course-live emails come from users and admins, so they are escaped.
const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const escapeAll = (variables) =>
  Object.fromEntries(Object.entries(variables).map(([key, value]) => [key, escapeHtml(value)]));

const LOCK_NOTE = "Videos unlock in order: each one opens when you complete the one before it.";

const purchaseReceiptVariables = (data) => ({
  USER_NAME: data.name,
  COURSE_TITLE: data.courseTitle,
  AMOUNT_PAID: data.amountPaid,
  ORIGINAL_PRICE: data.originalPrice,
  SAVINGS_TEXT: data.discountPercent > 0 ? `You saved ${data.discountPercent}%` : "",
  ORDER_ID: data.orderId,
  PURCHASE_DATE: data.purchaseDate,
  COURSE_URL: data.courseUrl,
  LOCK_NOTE: data.sequentialUnlock ? LOCK_NOTE : "",
});

const CoursePurchasedTemplate = async (data) => {
  const subject = `You're enrolled in ${data.courseTitle}`;
  const html = await RenderEmailTemplate("course_purchase_confirmation.html", escapeAll(purchaseReceiptVariables(data)));

  return { subject, html };
};

const CoursePurchasedPrelaunchTemplate = async (data) => {
  const subject = `You're in! Your prelaunch seat for ${data.courseTitle} is confirmed`;
  const html = await RenderEmailTemplate(
    "course_purchase_prelaunch.html",
    escapeAll({
      ...purchaseReceiptVariables(data),
      SAVINGS_TEXT: `Prelaunch price: ${data.discountPercent}% off`,
      LIVE_STATUS_TEXT: data.isLive
        ? "Your course is already live. Start your first class now."
        : data.courseLiveDate
          ? `Your course goes live on ${data.courseLiveDate}. We'll email you the moment it does.`
          : "We'll email you the moment your course goes live.",
    }),
  );

  return { subject, html };
};

const CourseLiveTemplate = async (data) => {
  const subject = `${data.courseTitle} is live. Your first class is ready`;
  const html = await RenderEmailTemplate(
    "course_live.html",
    escapeAll({
      USER_NAME: data.name,
      COURSE_TITLE: data.courseTitle,
      FIRST_VIDEO_TITLE: data.firstVideoTitle,
      COURSE_URL: data.courseUrl,
    }),
  );

  return { subject, html };
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
