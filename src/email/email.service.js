import { EnvConfig } from "#src/config/env.config.js";
import { GetEmailTemplate } from "#src/email/email.templates.js";
import nodemailer from "nodemailer";
import { Resend } from "resend";

const SENDER_NAME = "Kratika Yoga";
const RESEND_FROM_ADDRESS = "noreply@kratikayoga.com";
const smtpPort = Number(EnvConfig.EMAIL_SMTP_PORT) || 587;

// ENVIRONMENT=production sends through Resend; development sends through SMTP (e.g. Gmail).
// Each client is only created in the environment that uses it, so the other one's settings
// aren't required (Resend throws when it is created without an API key).
const resendClient =
  EnvConfig.IS_PRODUCTION && EnvConfig.RESEND_EMAIL_PROVIDER_API_KEY
    ? new Resend(EnvConfig.RESEND_EMAIL_PROVIDER_API_KEY)
    : null;

// Port 465 uses TLS from the start; 587 upgrades with STARTTLS.
const smtpTransporter = EnvConfig.IS_PRODUCTION
  ? null
  : nodemailer.createTransport({
      host: EnvConfig.EMAIL_SMTP_HOST,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: EnvConfig.EMAIL_SMTP_USER,
        pass: EnvConfig.EMAIL_SMTP_PASS,
      },
    });

export const VerifyEmailTransportConnectionService = async () => {
  if (EnvConfig.IS_PRODUCTION) {
    if (!resendClient) {
      console.error("Email transport verification failed: RESEND_EMAIL_PROVIDER_API_KEY is missing (ENVIRONMENT=production)");
      return;
    }
    console.log("Email transport: Resend (ENVIRONMENT=production)");
    return;
  }

  if (!EnvConfig.EMAIL_SMTP_HOST || !EnvConfig.EMAIL_SMTP_USER || !EnvConfig.EMAIL_SMTP_PASS) {
    console.error(
      "Email transport verification failed: EMAIL_SMTP_HOST, EMAIL_SMTP_USER or EMAIL_SMTP_PASS is missing (ENVIRONMENT=development)",
    );
    return;
  }

  try {
    await smtpTransporter.verify();
    console.log(`Email transport: SMTP ${EnvConfig.EMAIL_SMTP_HOST}:${smtpPort} connected (ENVIRONMENT=development)`);
  } catch (error) {
    // Don't stop the server; emails will fail until SMTP is fixed.
    console.error("SMTP email transport verification failed:", error.message);
  }
};

const sendWithResend = async ({ to, subject, html }) => {
  if (!resendClient) throw new Error("RESEND_EMAIL_PROVIDER_API_KEY is missing");

  const { data, error } = await resendClient.emails.send({
    from: `"${SENDER_NAME}" <${RESEND_FROM_ADDRESS}>`,
    to,
    subject,
    html,
  });
  if (error) throw error;
  return data?.id;
};

const sendWithSmtp = async ({ to, subject, html }) => {
  // Gmail only sends from the authenticated account, so use it as the sender address.
  const info = await smtpTransporter.sendMail({
    from: `"${SENDER_NAME}" <${EnvConfig.EMAIL_SMTP_USER}>`,
    to,
    subject,
    html,
  });
  return info.messageId;
};

export const SendEmailNotificationService = async (email, templateName, data) => {
  const response = await GetEmailTemplate(templateName, data);

  try {
    const message = { to: email, subject: response.subject, html: response.html };
    const messageId = EnvConfig.IS_PRODUCTION ? await sendWithResend(message) : await sendWithSmtp(message);

    console.log("Message sent: %s", messageId);
    return messageId;
  } catch (err) {
    console.error("Error while sending mail:", err);
    return err;
  }
};
