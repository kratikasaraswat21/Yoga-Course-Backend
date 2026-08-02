import { EnvConfig } from "#src/config/env.config.js";
import { GetEmailTemplate } from "#src/email/email.templates.js";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: EnvConfig.EMAIL_SMTP_HOST,
  port: EnvConfig.EMAIL_SMTP_PORT,
  secure: false, // true for 465, false for other ports

  auth: {
    user: EnvConfig.EMAIL_SMTP_USER,
    pass: EnvConfig.EMAIL_SMTP_PASS,
  },
});

export const VerifyEmailTransportConnectionService = async () => {
  try {
    await transporter.verify();
    console.log("Email Transport Connection Verified Successfully");
  } catch (err) {
    console.error("Email Transport Verification failed:", err);
  }
};

export const SendEmailNotificationService = async (email, templateName, data) => {
  const response = await GetEmailTemplate(templateName, data);
  try {
    const info = await transporter.sendMail({
      from: '"Example Team" <varun07.discordclone@gmail.com>',
      to: email,
      subject: response.subject,
      html: response.html,
    });

    console.log("Message sent: %s", info.messageId);
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
  } catch (err) {
    console.error("Error while sending mail:", err);
  }
};
