import { ValidateRequestParametersMiddleware } from "#src/middlewares/express-validator.middleware.js";
import { ValidateJWTToken } from "#src/middlewares/token.middleware.js";
import {
  AuthForgotPasswordController,
  AuthLoginController,
  AuthResendOtpController,
  AuthResetPasswordController,
  AuthSignUpController,
  AuthVerifyOtpController,
  VerifyUserLoginStatusController,
} from "#src/routes/modules/auth/auth.controller.js";
import { ERROR_MESSAGES } from "#src/utils/error.messages.js";
import { Router } from "express";
import { body } from "express-validator";

const authRoutes = Router();
//
//? ROUTE 1 ==> This is the route for user signup
//

authRoutes.post(
  "/sign-up",
  body("name").trim().exists().withMessage(ERROR_MESSAGES.NAME_REQUIRED),
  body("email").isEmail().withMessage(ERROR_MESSAGES.INVALID_EMAIL),
  body("password")
    .trim()
    .isLength({ min: 6, max: 50 })
    .withMessage(ERROR_MESSAGES.PASSWORD_LENGTH_INVALID),
  ValidateRequestParametersMiddleware,
  AuthSignUpController,
);

//
//? ROUTE 2 ==> This is the route for user login
//

authRoutes.post(
  "/login",
  body("email").isEmail().withMessage(ERROR_MESSAGES.INVALID_EMAIL),
  body("password")
    .trim()
    .isLength({ min: 6, max: 50 })
    .withMessage(ERROR_MESSAGES.PASSWORD_LENGTH_INVALID),
  ValidateRequestParametersMiddleware,
  AuthLoginController,
);

//
//? ROUTE 3 ==> This is the route for  email verification
//

authRoutes.post(
  "/verify-otp",
  body("email")
    .trim()
    .notEmpty()
    .isLength({ max: 512 })
    .withMessage(ERROR_MESSAGES.ENCRYPTED_EMAIL_REQUIRED),
  body("otp")
    .trim()
    .matches(/^\d{6}$/)
    .withMessage(ERROR_MESSAGES.OTP_INVALID),
  ValidateRequestParametersMiddleware,
  AuthVerifyOtpController,
);

//
//? ROUTE 4 ==> This is the route for  resend otp
//

authRoutes.post(
  "/resend-otp",
  body("email")
    .trim()
    .notEmpty()
    .isLength({ max: 512 })
    .withMessage(ERROR_MESSAGES.ENCRYPTED_EMAIL_REQUIRED),
  ValidateRequestParametersMiddleware,
  AuthResendOtpController,
);

//
//? ROUTE 5 ==> This is the route for  forgot password
//

authRoutes.post(
  "/forgot-password",
  body("email").isEmail().withMessage(ERROR_MESSAGES.INVALID_EMAIL),
  ValidateRequestParametersMiddleware,
  AuthForgotPasswordController,
);

//
//? ROUTE 6 ==> This is the route for user reset password
//

authRoutes.post(
  "/reset-password",
  body("token").trim().notEmpty().withMessage(ERROR_MESSAGES.TOKEN_REQUIRED),
  body("password")
    .trim()
    .isLength({ min: 6, max: 100 })
    .withMessage(ERROR_MESSAGES.PASSWORD_RESET_LENGTH_INVALID),
  ValidateRequestParametersMiddleware,
  AuthResetPasswordController,
);

//
//? ROUTE 7 ==> This is the route for verifying the user login status
//

authRoutes.get("/verify/me", ValidateJWTToken, VerifyUserLoginStatusController);

export default authRoutes;
