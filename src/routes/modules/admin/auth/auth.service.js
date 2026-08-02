import { EnvConfig } from "#src/config/env.config.js";
import { UserRole } from "#src/lib/enum.js";
import { prisma } from "#src/lib/prisma.js";
import bcrypt from "bcrypt";
import { createHash, randomBytes, randomInt } from "node:crypto";

//
//? SERVICE 1: Retrieve Admin Account by Email
//
export const GetAdminInfoByEmailService = async (email) => {
  const user = await prisma.user.findUnique({
    where: {
      email,
      role: UserRole.ADMIN,
    },
  });

  return user;
};

//
//? SERVICE 2: Retrieve the Existing Admin Account
//
export const GetAdminInfoWithRole = async () => {
  const user = await prisma.user.findFirst({
    where: {
      role: UserRole.ADMIN,
    },
  });

  return user;
};

//
//? SERVICE 3: Retrieve Admin Account by ID Without Password
//
export const GetAdminInfoById = async (userId) => {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      role: UserRole.ADMIN,
    },
    omit: {
      password: true,
    },
  });

  return user;
};

//
//? SERVICE 4: Generate and Store Admin Password-Reset Token
//
export const CreatePasswordResetTokenService = async (userId) => {
  const rawToken = randomBytes(32).toString("hex");

  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  const expiresAt = new Date(Date.now() + EnvConfig.PASSWORD_RESET_EXPIRES_MINUTES * 60 * 1000);

  await prisma.passwordResetToken.upsert({
    where: {
      userId,
    },
    update: {
      tokenHash,
      expiresAt,
      createdAt: new Date(),
    },
    create: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return {
    rawToken,
    expiresAt,
  };
};

//
//? SERVICE 5: Retrieve Password-Reset Token Using Raw Token
//
export const GetPasswordResetTokenService = async (rawToken) => {
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  return prisma.passwordResetToken.findUnique({
    where: {
      tokenHash,
    },
    include: {
      user: true,
    },
  });
};

//
//? SERVICE 6: Reset Admin Password and Consume Reset Token
//
export const ResetAdminPasswordService = async (userId, tokenId, passwordHash) => {
  return prisma.$transaction([
    prisma.passwordResetToken.delete({
      where: {
        id: tokenId,
      },
    }),

    prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        password: passwordHash,
      },
    }),
  ]);
};

//
//? SERVICE 7: Generate and Store Admin Email-Verification OTP
//
export const CreateAdminEmailVerificationTokenService = async (userId) => {
  const otp = randomInt(100000, 1000000).toString();

  const otpHash = await bcrypt.hash(otp, EnvConfig.HASH_PASSWORD_SALT);

  const expiresAt = new Date(Date.now() + EnvConfig.OTP_EXPIRES_MINUTES * 60 * 1000);

  await prisma.emailVerificationToken.deleteMany({
    where: {
      userId,
      validatedAt: null,
    },
  });

  const newOtp = await prisma.emailVerificationToken.create({
    data: {
      userId,
      otpHash,
      expiresAt,
    },
  });

  return {
    otp,
    expiresAt,
    otpId: newOtp.id,
  };
};

//
//? SERVICE 8: Regenerate Admin Email-Verification OTP
//
export const ReCreateAdminEmailVerificationOTP = async (userId, previousOtpId) => {
  const otp = randomInt(100000, 1000000).toString();

  const otpHash = await bcrypt.hash(otp, EnvConfig.HASH_PASSWORD_SALT);

  const expiresAt = new Date(Date.now() + EnvConfig.OTP_EXPIRES_MINUTES * 60 * 1000);

  await prisma.emailVerificationToken.update({
    where: {
      id: previousOtpId,
    },
    data: {
      userId,
      otpHash,
      expiresAt,
    },
  });

  return {
    otp,
    expiresAt,
  };
};

//
//? SERVICE 9: Retrieve the Latest Active Email-Verification OTP
//
export const GetActiveEmailVerificationTokenService = async (userId) => {
  return prisma.emailVerificationToken.findFirst({
    where: {
      userId,
      validatedAt: null,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
};

//
//? SERVICE 10: Verify Admin Email and Consume Verification Token
//
export const VerifyUserEmailService = async (userId, tokenId) => {
  return prisma.$transaction([
    prisma.emailVerificationToken.delete({
      where: {
        id: tokenId,
      },
    }),

    prisma.user.update({
      where: {
        id: userId,
        role: UserRole.ADMIN,
      },
      data: {
        emailVerifiedAt: new Date(),
      },
    }),
  ]);
};
