import { EnvConfig } from "#src/config/env.config.js";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

const getEncryptionKey = () => {
  const secret = EnvConfig.AUTH_EMAIL_ENCRYPTION_SECRET ?? EnvConfig.JWT_SECRET;

  if (!secret) {
    throw new Error("Email encryption secret is not configured.");
  }

  return createHash("sha256").update(secret).digest();
};

export const encryptEmail = (email) => {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(email, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv, authTag, encrypted].map((value) => value.toString("base64url")).join(".");
};

export const decryptEmail = (encryptedEmail) => {
  try {
    const [ivValue, authTagValue, encryptedValue] = encryptedEmail.split(".");

    if (!ivValue || !authTagValue || !encryptedValue) {
      throw new Error("Invalid encrypted email format.");
    }

    const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(authTagValue, "base64url"));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");

    if (!decrypted) {
      throw new Error("Encrypted email is empty.");
    }

    return decrypted;
  } catch {
    throw new Error("Invalid encrypted email.");
  }
};
