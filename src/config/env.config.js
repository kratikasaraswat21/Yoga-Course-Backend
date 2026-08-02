import "dotenv/config";

export const EnvConfig = {
  PORT: parseInt(process.env.PORT ?? "501", 10),
  DATABASE_URL: process.env.DATABASE_URL,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  HASH_PASSWORD_SALT: parseInt(process.env.HASH_PASSWORD_SALT),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
  JWT_SECRET: process.env.JWT_SECRET,
  OTP_EXPIRES_MINUTES: parseInt(process.env.OTP_EXPIRES_MINUTES ?? "10", 10),
  PASSWORD_RESET_EXPIRES_MINUTES: parseInt(process.env.PASSWORD_RESET_EXPIRES_MINUTES ?? "15", 10),
  PASSWORD_RESET_URL: process.env.PASSWORD_RESET_URL ?? "http://localhost:3000/reset-password",

  EMAIL_SMTP_HOST: process.env.EMAIL_SMTP_HOST,
  EMAIL_SMTP_PORT: process.env.EMAIL_SMTP_PORT,
  EMAIL_SMTP_USER: process.env.EMAIL_SMTP_USER,
  EMAIL_SMTP_PASS: process.env.EMAIL_SMTP_PASS,

  PLATFORM_OWNER_MAIL: process.env.PLATFORM_OWNER_MAIL,
  PLATFORM_OWNER_NAME: process.env.PLATFORM_OWNER_NAME,
};
