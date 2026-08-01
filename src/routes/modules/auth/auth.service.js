import { prisma } from "#src/lib/prisma.js";

export const GetUserByEmailService = async (email) => {
  const user = await prisma.user.findUnique({ email: email });

  return user;
};

export const CreateUserService = async (data) => {
  return await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      password: data.passwordHash,
    },
  });
};
