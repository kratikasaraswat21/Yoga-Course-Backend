import "dotenv/config";

export const EnvConfig = {
  PORT: parseInt(process.env.PORT ?? "501", 10),
  DATABASE_URL: process.env.DATABASE_URL,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  HASH_PASSWORD_SALT: parseInt(process.env.HASH_PASSWORD_SALT),
};
