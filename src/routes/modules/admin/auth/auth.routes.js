import { ValidateJWTToken } from "#src/middlewares/token.middleware.js";
import {
  VerifyAdminLoginCredentialController,
  VerifyAdminLoginStatusController,
} from "#src/routes/modules/admin/auth/auth.controller.js";
import { Router } from "express";
import { body } from "express-validator";

const adminAuthRoutes = Router();

//
//? ROUTE 1 ==> This is the route for Admin Login
//

adminAuthRoutes.post(
  "/login",
  body("email").isEmail(),
  body("password").trim().isLength({ min: 6, max: 100 }),
  VerifyAdminLoginCredentialController,
);

//
//? ROUTE 2 ==> This is the route for Verifying the user info
//

adminAuthRoutes.get("/verify/me", ValidateJWTToken, VerifyAdminLoginStatusController);

export default adminAuthRoutes;
