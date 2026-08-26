import { EnvConfig } from "#src/config/env.config.js";
import { GetEmailTemplate } from "#src/email/email.templates.js";
import { Resend } from "resend";

// Google SMTP transporter (kept for reference; Resend is currently active).
// const transporter = nodemailer.createTransport({
//   host: EnvConfig.EMAIL_SMTP_HOST,
//   port: EnvConfig.EMAIL_SMTP_PORT,
//   secure: false, // true for 465, false for other ports

//   auth: {
//     user: EnvConfig.EMAIL_SMTP_USER,
//     pass: EnvConfig.EMAIL_SMTP_PASS,
//   },
// });

const transporter = new Resend(EnvConfig.RESEND_EMAIL_PROVIDER_API_KEY);

export const VerifyEmailTransportConnectionService = async () => {
  if (!EnvConfig.RESEND_EMAIL_PROVIDER_API_KEY) {
    console.error("Email Transport Verification failed: RESEND_EMAIL_PROVIDER_API_KEY is missing");
    return;
  }

  console.log("Resend email transport configured successfully");
};

export const SendEmailNotificationService = async (email, templateName, data) => {
  const response = await GetEmailTemplate(templateName, data);
  try {
    const { data: info, error } = await transporter.emails.send({
      from: '"Kratika Yoga" <noreply@kratikayoga.com>',
      to: email,
      subject: response.subject,
      html: response.html,
    });

    if (error) {
      throw error;
    }

    console.log("Message sent: %s", info?.id);
  } catch (err) {
    console.error("Error while sending mail:", err);
  }
};
