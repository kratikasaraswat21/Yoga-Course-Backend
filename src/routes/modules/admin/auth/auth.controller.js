import { EnvConfig } from "#src/config/env.config.js";
import { SendEmailNotificationService } from "#src/email/email.service.js";
import {
  CreateAdminEmailVerificationTokenService,
  GetAdminInfoByEmailService,
  GetAdminInfoById,
  GetAdminInfoWithRole,
  ReCreateAdminEmailVerificationOTP,
  ResetAdminPasswordService,
} from "#src/routes/modules/admin/auth/auth.service.js";
import {
  CreatePasswordResetTokenService,
  GetActiveEmailVerificationTokenService,
  GetPasswordResetTokenService,
  IncrementOtpAttemptsService,
  VerifyUserEmailService,
} from "#src/routes/modules/auth/auth.service.js";
import asyncHandler from "#src/utils/async-handler.util.js";
import { ERROR_MESSAGES } from "#src/utils/error.messages.js";
import { SUCCESS_MESSAGES } from "#src/utils/success.message.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

//
//
//? CONTROLLER 1 ===> This is the Controller for the admin login route
//
//

export const VerifyAdminLoginCredentialController = asyncHandler(async (req, res) => {
  const email = req.body.email?.trim()?.toLowerCase();
  const password = req.body.password;

  const admin_info = await GetAdminInfoByEmailService(email);

  if (!admin_info) {
    return res.status(404).json({ message: ERROR_MESSAGES.USER_NOT_FOUND });
  }

  const comparePassword = await bcrypt.compare(password, admin_info.password);

  if (!comparePassword) {
    return res.status(400).json({ message: ERROR_MESSAGES.INVALID_CREDENTIALS });
  }

  const otp_service_data = await CreateAdminEmailVerificationTokenService(admin_info.id);

  SendEmailNotificationService("varun07.discordclone@gmail.com", "ADMIN_EMAIL_OTP_VERIFICATION", {
    otp: otp_service_data.otp,
    name: EnvConfig.PLATFORM_OWNER_NAME,
  });

  return res.status(200).json({
    message: SUCCESS_MESSAGES.OTP_SENT_SUCCESSFULLY,
    success: true,
    data: {
      requires_email_verification: true,
      signature: otp_service_data.otp_id,
    },
  });
});

//
//
//? CONTROLLER 2 ===> This is the Controller for the admin auth token verification
//
//

export const VerifyAdminLoginStatusController = asyncHandler(async (req, res) => {
  const user_id = req.user.id;

  if (!user_id) {
    return res.status(400).json({
      message: ERROR_MESSAGES.USER_ID_NOT_FOUND,
      success: false,
    });
  }

  const data = await GetAdminInfoById(user_id);

  if (!data) {
    return res.status(400).json({
      message: ERROR_MESSAGES.USER_NOT_FOUND,
      success: false,
    });
  }

  return res.status(200).json({
    message: SUCCESS_MESSAGES.USER_VERIFIED_SUCCESSFULLY,
    success: true,
    data: {
      user_info: data,
    },
  });
});

//
//
//? CONTROLLER 3 ===> This is the Controller for the admin forgot password function
//
//

export const AdminForgotPasswordController = asyncHandler(async (req, res) => {
  const admin_info = await GetAdminInfoWithRole();

  if (!admin_info) {
    return res.status(404).json({ message: ERROR_MESSAGES.USER_NOT_FOUND });
  }

  const { rawToken } = await CreatePasswordResetTokenService(admin_info.id);

  const resetUrl = `${EnvConfig.PASSWORD_RESET_URL}?token=${encodeURIComponent(rawToken)}`;

  SendEmailNotificationService(EnvConfig.PLATFORM_OWNER_MAIL, "EMAIL_PASSWORD_RESET", {
    name: EnvConfig.PLATFORM_OWNER_NAME,
    resetUrl,
  });

  return res.status(200).json({
    message: SUCCESS_MESSAGES.PASSWORD_RESET_REQUEST_ACCEPTED,
    success: true,
    data: {
      rawToken: rawToken,
    },
  });
});

//
//
//? CONTROLLER 4 ===> This is the Controller for the admin reset password function
//
//

export const AdminResetPasswordController = asyncHandler(async (req, res) => {
  const token = req.body.token?.trim();
  const password = req.body.password;

  if (!token) {
    return res.status(400).json({ message: ERROR_MESSAGES.INVALID_OR_EXPIRED_PASSWORD_RESET_TOKEN });
  }

  const resetToken = await GetPasswordResetTokenService(token);

  if (!resetToken || resetToken.expiresAt <= new Date()) {
    return res.status(400).json({ message: ERROR_MESSAGES.INVALID_OR_EXPIRED_PASSWORD_RESET_TOKEN });
  }

  const passwordHash = await bcrypt.hash(password, EnvConfig.HASH_PASSWORD_SALT);

  await ResetAdminPasswordService(resetToken.userId, resetToken.id, passwordHash);

  return res.status(200).json({
    message: SUCCESS_MESSAGES.PASSWORD_RESET_SUCCESSFULLY,
    success: true,
  });
});

//
//
//? CONTROLLER 5 ===> This is the Controller for the admin  OTP verification Function
//
//

export const AdminAuthVerifyOtpController = asyncHandler(async (req, res) => {
  const otp = req.body.otp.trim();
  const admin_info = await GetAdminInfoWithRole();

  if (!admin_info) return res.status(404).json({ message: ERROR_MESSAGES.USER_NOT_FOUND });

  const verificationToken = await GetActiveEmailVerificationTokenService(admin_info.id);

  if (!verificationToken || verificationToken.expiresAt <= new Date()) {
    return res.status(400).json({ message: ERROR_MESSAGES.INVALID_OR_EXPIRED_OTP });
  }

  if (verificationToken.attemptsCount >= verificationToken.maxAttempts) {
    return res.status(429).json({ message: ERROR_MESSAGES.OTP_ATTEMPTS_EXCEEDED });
  }

  const validOtp = await bcrypt.compare(otp, verificationToken.otpHash);

  if (!validOtp) {
    await IncrementOtpAttemptsService(verificationToken.id);
    return res.status(400).json({ message: ERROR_MESSAGES.INVALID_OR_EXPIRED_OTP });
  }

  await VerifyUserEmailService(admin_info.id, verificationToken.id);

  const jwtToken = jwt.sign({ id: admin_info.id, email: admin_info.email }, EnvConfig.JWT_SECRET, {
    expiresIn: EnvConfig.JWT_EXPIRES_IN,
  });

  return res.status(200).json({
    message: SUCCESS_MESSAGES.EMAIL_VERIFIED_SUCCESSFULLY,
    success: true,
    data: {
      auth_token: jwtToken,
    },
  });
});

//
//
//? CONTROLLER 6 ===> This is the Controller for the Resending the Admin Login Otp
//
//

export const ResendAdminLoginOtpVerificationOtp = asyncHandler(async (req, res) => {
  const prev_otp_id = req.query.signature;

  const admin_info = await GetAdminInfoWithRole();

  if (!admin_info) {
    return res.status(404).json({ message: ERROR_MESSAGES.USER_NOT_FOUND });
  }

  const otp_service_data = await ReCreateAdminEmailVerificationOTP(admin_info.id, prev_otp_id);

  if (!otp_service_data) {
    return res.status(400).json({
      message: ERROR_MESSAGES.INVALID_OR_BROKEN_OTP_SIGNATURE,
      success: false,
    });
  }

  SendEmailNotificationService(EnvConfig.PLATFORM_OWNER_MAIL, "ADMIN_EMAIL_OTP_VERIFICATION", {
    otp: otp_service_data.otp,
    name: EnvConfig.PLATFORM_OWNER_NAME,
  });

  return res.status(200).json({
    message: SUCCESS_MESSAGES.OTP_SENT_SUCCESSFULLY,
    success: true,
  });
});
