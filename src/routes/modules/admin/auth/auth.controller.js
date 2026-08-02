import { EnvConfig } from "#src/config/env.config.js";
import { GetAdminInfoByEmailService, GetAdminInfoById } from "#src/routes/modules/admin/auth/auth.service.js";
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
  console.log(admin_info);

  if (!admin_info) {
    return res.status(404).json({ message: ERROR_MESSAGES.USER_NOT_FOUND });
  }

  const comparePassword = await bcrypt.compare(password, admin_info.password);

  console.log(comparePassword);

  if (!comparePassword) {
    return res.status(400).json({ message: ERROR_MESSAGES.INVALID_CREDENTIALS });
  }

  const jwt_token = jwt.sign({ id: admin_info.id, email: admin_info.email }, EnvConfig.JWT_SECRET, {
    expiresIn: EnvConfig.JWT_EXPIRES_IN,
  });

  return res.status(200).json({
    message: SUCCESS_MESSAGES.ADMIN_LOGIN_SUCCESSFULLY,
    Success: true,
    data: {
      auth_token: jwt_token,
    },
  });
});

//
//
//? CONTROLLER 1 ===> This is the Controller for the admin auth token verification
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

  return res.status(200).json({
    message: SUCCESS_MESSAGES.USER_VERIFIED_SUCCESSFULLY,
    success: true,
    data: {
      user_info: data,
    },
  });
});
