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
import { Router } from "express";
import { body } from "express-validator";

const authRoutes = Router();
//
//? ROUTE 1 ==> This is the route for user signup
//

authRoutes.post(
  "/sign-up",
  body("name").trim().exists(),
  body("email").isEmail(),
  body("password").trim().isLength({ min: 6, max: 10 }),
  AuthSignUpController,
);

//
//? ROUTE 2 ==> This is the route for user login
//

authRoutes.post(
  "/login",
  body("email").isEmail(),
  body("password").trim().isLength({ min: 6, max: 10 }),
  AuthLoginController,
);

//
//? ROUTE 3 ==> This is the route for  email verification
//

authRoutes.post(
  "/verify-otp",
  body("email").isEmail(),
  body("otp")
    .trim()
    .matches(/^\d{6}$/),
  AuthVerifyOtpController,
);

//
//? ROUTE 4 ==> This is the route for  resend otp
//

authRoutes.post("/resend-otp", body("email").isEmail(), AuthResendOtpController);

//
//? ROUTE 5 ==> This is the route for  forgot password
//

authRoutes.post("/forgot-password", body("email").isEmail(), AuthForgotPasswordController);

//
//? ROUTE 6 ==> This is the route for user reset password
//

authRoutes.post(
  "/reset-password",
  body("token").trim().notEmpty(),
  body("password").trim().isLength({ min: 6, max: 100 }),
  AuthResetPasswordController,
);

//
//? ROUTE 7 ==> This is the route for verifying the user login status
//

authRoutes.get("/verify/me", ValidateJWTToken, VerifyUserLoginStatusController);

export default authRoutes;
