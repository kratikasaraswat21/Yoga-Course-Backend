import { EnvConfig } from "#src/config/env.config.js";
import { UserRole, UserStatus } from "#src/lib/enum.js";
import { prisma } from "#src/lib/prisma.js";
import bcrypt from "bcrypt";

export async function AdminSeedFunction() {
  const ADMIN_EMAIL = EnvConfig.ADMIN_EMAIL;
  const ADMIN_PASSWORD = EnvConfig.ADMIN_PASSWORD;

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error("PREDEFINED_MAIL and PREDEFINED_PASSWORD must be configured.");
  }

  const passwordHash = bcrypt.hashSync(ADMIN_PASSWORD, EnvConfig.HASH_PASSWORD_SALT);

  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      password: passwordHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
    create: {
      name: "Admin",
      email: ADMIN_EMAIL,
      password: passwordHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
  });
}
