import { GetAdminInfoById } from "#src/routes/modules/admin/auth/auth.service.js";
import asyncHandler from "#src/utils/async-handler.util.js";
import { ERROR_MESSAGES } from "#src/utils/error.messages.js";
import jwt from "jsonwebtoken";

export const AdminValidateMiddleware = asyncHandler(async (req, res, next) => {
  // Express normalizes incoming header names to lowercase.
  const authHeader = req.headers.authorization;

  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(404).json({ success: false, message: ERROR_MESSAGES.ACCESS_DENIED });

  let verifiedData;
  try {
    verifiedData = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(404).json({ message: ERROR_MESSAGES.INVALID_TOKEN, success: false });
  }

  const data = await GetAdminInfoById(verifiedData.id);

  if (!data) {
    return res.status(404).json({
      message: ERROR_MESSAGES.USER_NOT_FOUND,
      success: false,
    });
  }

  req.user = verifiedData;
  next();
});
