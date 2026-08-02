import { UserRole } from "#src/lib/enum.js";
import { prisma } from "#src/lib/prisma.js";

export const GetAdminInfoByEmailService = async (email) => {
  const user = await prisma.user.findUnique({ where: { email: email, role: UserRole.ADMIN } });
  return user;
};

export const  GetAdminInfoById = async (user_id) => {
  const user = await prisma.user.findFirst({ where: { id: user_id, role: UserRole.ADMIN }, omit: { password: true } });

  return user;
};
