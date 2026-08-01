import { AuthLoginController, AuthSignUpController } from "#src/routes/modules/auth/auth.controller.js";
import { Router } from "express";
import { body } from "express-validator";

const authRoutes = Router();

authRoutes.post(
  "/login",
  body("email").isEmail(),
  body("password").trim().isLength({ min: 6, max: 10 }),
  async (req, res) => {
    return await AuthLoginController(req, res);
  },
);

authRoutes.post(
  "/sign-up",
  body("name").trim().exists(),
  body("email").isEmail(),
  body("password").trim().isLength({ min: 6, max: 10 }),
  async (req, res) => {
    return await AuthSignUpController(req, res);
  },
);

export default authRoutes;
