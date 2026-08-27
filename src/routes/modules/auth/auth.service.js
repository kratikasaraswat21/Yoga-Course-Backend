import { EnvConfig } from "#src/config/env.config.js";
import { prisma } from "#src/lib/prisma.js";
import bcrypt from "bcrypt";
import { createHash, randomBytes, randomInt } from "node:crypto";

//
//? SERVICE 1: Retrieve User Account by Email
//
export const GetUserByEmailService = async (email) => {
  const user = await prisma.user.findUnique({ where: { email: email, role: "USER" } });

  return user;
};

//
//? SERVICE 2: Retrieve User Account by ID Without Password
//
export const GetUserInfoById = async (user_id) => {
  const user = await prisma.user.findFirst({
    where: { id: user_id, role: "USER" },
    omit: { password: true },
  });

  return user;
};

//
//? SERVICE 3: Create a New User Account
//
export const CreateUserService = async (data) => {
  return await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      password: data.passwordHash,
      role: "USER",
    },
  });
};

//
//? SERVICE 4: Generate and Store User Email-Verification OTP
//
export const CreateEmailVerificationTokenService = async (userId) => {
  const otp = randomInt(100000, 1000000).toString();
  const otpHash = await bcrypt.hash(otp, EnvConfig.HASH_PASSWORD_SALT);
  const expiresAt = new Date(Date.now() + EnvConfig.OTP_EXPIRES_MINUTES * 60 * 1000);

  await prisma.emailVerificationToken.deleteMany({
    where: { userId, validatedAt: null },
  });

  await prisma.emailVerificationToken.create({
    data: { userId, otpHash, expiresAt },
  });

  return { otp, expiresAt };
};

//
//? SERVICE 5: Retrieve the Latest Active Email-Verification OTP
//
export const GetActiveEmailVerificationTokenService = async (userId) => {
  return prisma.emailVerificationToken.findFirst({
    where: { userId, validatedAt: null },
    orderBy: { createdAt: "desc" },
  });
};

//
//? SERVICE 6: Increment Failed OTP Verification Attempts
//
export const IncrementOtpAttemptsService = async (id) => {
  return prisma.emailVerificationToken.update({
    where: { id },
    data: { attemptsCount: { increment: 1 } },
  });
};

//
//? SERVICE 7: Verify User Email and Consume Verification Token
//
export const VerifyUserEmailService = async (userId, tokenId) => {
  return prisma.$transaction([
    prisma.emailVerificationToken.delete({
      where: { id: tokenId },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    }),
  ]);
};

//
//? SERVICE 8: Generate and Store User Password-Reset Token
//
export const CreatePasswordResetTokenService = async (userId) => {
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + EnvConfig.PASSWORD_RESET_EXPIRES_MINUTES * 60 * 1000);

  await prisma.passwordResetToken.upsert({
    where: { userId: userId },
    update: {
      tokenHash,
      expiresAt,
      createdAt: new Date(),
    },
    create: {
      userId: userId,
      tokenHash,
      expiresAt,
    },
  });

  return { rawToken, expiresAt };
};

//
//? SERVICE 9: Retrieve Password-Reset Token Using Raw Token
//
export const GetPasswordResetTokenService = async (rawToken) => {
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  return prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      user: { role: "USER" },
    },
    include: { user: true },
  });
};

//
//? SERVICE 10: Reset User Password and Consume Reset Token
//
export const ResetUserPasswordService = async (userId, tokenId, passwordHash) => {
  return prisma.$transaction([
    prisma.passwordResetToken.delete({
      where: { id: tokenId },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { password: passwordHash },
    }),
  ]);
};
