import { ValidateRequestParametersMiddleware } from "#src/middlewares/express-validator.middleware.js";
import { ValidateJWTToken } from "#src/middlewares/token.middleware.js";
import {
  AdminAuthVerifyOtpController,
  AdminForgotPasswordController,
  AdminResetPasswordController,
  ResendAdminLoginOtpVerificationOtp,
  VerifyAdminLoginCredentialController,
  VerifyAdminLoginStatusController,
} from "#src/routes/modules/admin/auth/auth.controller.js";
import { Router } from "express";
import { body, query } from "express-validator";

const adminAuthRoutes = Router();

//
//? ROUTE 1 ==> This is the route for Admin Login
//

adminAuthRoutes.post(
  "/login",
  body("email").isEmail(),
  body("password").trim().isLength({ min: 6, max: 100 }),
  ValidateRequestParametersMiddleware,
  VerifyAdminLoginCredentialController,
);

//
//? ROUTE 2 ==> This is the route for the forgot admin password
//

adminAuthRoutes.post("/forgot-password", AdminForgotPasswordController);

//
//? ROUTE 3 ==> This is the route for the reset admin password
//

adminAuthRoutes.post(
  "/reset-password",
  body("token").trim().notEmpty(),
  body("password").trim().isLength({ min: 6, max: 100 }),
  ValidateRequestParametersMiddleware,
  AdminResetPasswordController,
);

//
//? ROUTE 4 ==> This is the route for Verifying the user info
//

adminAuthRoutes.get("/verify/me", ValidateJWTToken, VerifyAdminLoginStatusController);

//
//? ROUTE 5 ==> This is the route for Verifying the Admin With the otp
//

adminAuthRoutes.post(
  "/verify-otp",
  body("otp")
    .trim()
    .matches(/^\d{6}$/),
  ValidateRequestParametersMiddleware,
  AdminAuthVerifyOtpController,
);

//
//? ROUTE 6 ==> This is the route for Verifying the Admin With the otp
//

adminAuthRoutes.post(
  "/resend-otp",
  query("signature"),
  ValidateRequestParametersMiddleware,
  ResendAdminLoginOtpVerificationOtp,
);

export default adminAuthRoutes;
