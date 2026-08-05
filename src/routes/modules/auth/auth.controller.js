import { EnvConfig } from "#src/config/env.config.js";
import { SendEmailNotificationService } from "#src/email/email.service.js";
import {
  CreateEmailVerificationTokenService,
  CreatePasswordResetTokenService,
  CreateUserService,
  GetActiveEmailVerificationTokenService,
  GetPasswordResetTokenService,
  GetUserByEmailService,
  GetUserInfoById,
  IncrementOtpAttemptsService,
  ResetUserPasswordService,
  VerifyUserEmailService,
} from "#src/routes/modules/auth/auth.service.js";
import asyncHandler from "#src/utils/async-handler.util.js";
import { ERROR_MESSAGES } from "#src/utils/error.messages.js";
import { SUCCESS_MESSAGES } from "#src/utils/success.message.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

//
//
//? CONTROLLER 1 ===> This is the Controller for the signup route
//
//

export const AuthSignUpController = asyncHandler(async (req, res) => {
  const email = req.body.email;
  const name = req.body.name;
  const password = req.body.password;
  const normalizedEmail = email.trim().toLowerCase();

  const findUser = await GetUserByEmailService(normalizedEmail);

  if (findUser) {
    return res.status(400).json({ message: ERROR_MESSAGES.USER_ALREADY_EXISTS });
  }

  const passwordHash = bcrypt.hashSync(password, EnvConfig.HASH_PASSWORD_SALT);

  const user = await CreateUserService({ name, email: normalizedEmail, passwordHash });

  const verification = await CreateEmailVerificationTokenService(user.id);

  SendEmailNotificationService(user.email, "EMAIL_OTP_VERIFICATION", { otp: verification.otp, name: name });

  return res.status(201).json({
    message: SUCCESS_MESSAGES.OTP_SENT_SUCCESSFULLY,
    success: true,
    data: {
      requires_email_verification: true,
      email: user.email,
    },
  });
});

//
//
//? CONTROLLER 2 ===> This is the Controller for the login route
//
//

export const AuthLoginController = asyncHandler(async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;
  const normalizedEmail = email.trim().toLowerCase();

  const findUser = await GetUserByEmailService(normalizedEmail);

  if (!findUser) {
    return res.status(404).json({ message: ERROR_MESSAGES.USER_NOT_FOUND });
  }

  const comparePassword = await bcrypt.compare(password, findUser.password);

  if (!comparePassword) {
    return res.status(400).json({ message: ERROR_MESSAGES.INVALID_CREDENTIALS });
  }

  const jwt_token = jwt.sign({ id: findUser.id, email: findUser.email }, EnvConfig.JWT_SECRET, {
    expiresIn: EnvConfig.JWT_EXPIRES_IN,
  });

  return res.status(200).json({
    message: SUCCESS_MESSAGES.USER_LOGGED_IN_SUCCESSFULLY,
    success: true,
    data: {
      auth_token: jwt_token,
    },
  });
});

//
//
//? CONTROLLER 3 ===> This is the Controller for the OTP verification route
//
//

export const AuthVerifyOtpController = asyncHandler(async (req, res) => {
  const email = req.body.email.trim().toLowerCase();
  const otp = req.body.otp.trim();
  const user = await GetUserByEmailService(email);

  if (!user) return res.status(404).json({ message: ERROR_MESSAGES.USER_NOT_FOUND });

  if (user.emailVerifiedAt) {
    return res.status(400).json({ message: ERROR_MESSAGES.EMAIL_ALREADY_VERIFIED });
  }

  const verificationToken = await GetActiveEmailVerificationTokenService(user.id);

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

  await VerifyUserEmailService(user.id, verificationToken.id);

  const jwtToken = jwt.sign({ id: user.id, email: user.email }, EnvConfig.JWT_SECRET, {
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
//? CONTROLLER 4 ===> This is the Controller for the Resend OTP verification code
//
//
export const AuthResendOtpController = asyncHandler(async (req, res) => {
  const email = req.body.email.trim().toLowerCase();
  const user = await GetUserByEmailService(email);

  if (!user) {
    return res.status(404).json({ message: ERROR_MESSAGES.USER_NOT_FOUND });
  }

  if (user.emailVerifiedAt) {
    return res.status(400).json({ message: ERROR_MESSAGES.EMAIL_ALREADY_VERIFIED });
  }

  const verification = await CreateEmailVerificationTokenService(user.id);

  SendEmailNotificationService(user.email, "EMAIL_OTP_VERIFICATION", { otp: verification.otp, name: user.name });

  return res.status(200).json({
    message: SUCCESS_MESSAGES.OTP_SENT_SUCCESSFULLY,
    success: true,
    data: {
      requires_email_verification: true,
      email: user.email,
    },
  });
});

//
//
//? CONTROLLER 5 ===> This is the Controller for the forgot password route
//
//

export const AuthForgotPasswordController = asyncHandler(async (req, res) => {
  const email = req.body.email.trim().toLowerCase();

  const user = await GetUserByEmailService(email);
  if (!user) {
    return res.status(404).json({ message: ERROR_MESSAGES.USER_NOT_FOUND });
  }

  const { rawToken } = await CreatePasswordResetTokenService(user.id);
  const resetUrl = `${EnvConfig.PASSWORD_RESET_URL}?token=${encodeURIComponent(rawToken)}`;

  SendEmailNotificationService(user.email, "EMAIL_PASSWORD_RESET", {
    name: user.name,
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
//? CONTROLLER 6 ===> This is the Controller for the reset password route
//
//

export const AuthResetPasswordController = asyncHandler(async (req, res) => {
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
  await ResetUserPasswordService(resetToken.userId, resetToken.id, passwordHash);

  return res.status(200).json({
    message: SUCCESS_MESSAGES.PASSWORD_RESET_SUCCESSFULLY,
    success: true,
  });
});

//
//
//? CONTROLLER 7 ===> This is the Controller for the verifying the user login status route
//
//

export const VerifyUserLoginStatusController = asyncHandler(async (req, res) => {
  const user_id = req.user.id;

  if (!user_id) {
    return res.status(400).json({
      message: ERROR_MESSAGES.USER_ID_NOT_FOUND,
      success: false,
    });
  }

  const data = await GetUserInfoById(user_id);

  return res.status(200).json({
    message: SUCCESS_MESSAGES.USER_VERIFIED_SUCCESSFULLY,
    success: true,
    data: {
      user_info: data,
    },
  });
});
