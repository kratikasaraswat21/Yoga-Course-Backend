import { GetUserInfoById } from "#src/routes/modules/auth/auth.service.js";
import asyncHandler from "#src/utils/async-handler.util.js";
import { ERROR_MESSAGES } from "#src/utils/error.messages.js";
import jwt from "jsonwebtoken";

export const OptionalUserMiddleware = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

  if (!token) return next();

  try {
    const verifiedData = jwt.verify(token, process.env.JWT_SECRET);
    const user = await GetUserInfoById(verifiedData.id);

    if (!user) {
      return res.status(400).json({ success: false, message: ERROR_MESSAGES.USER_NOT_FOUND });
    }

    req.user = verifiedData;
    next();
  } catch (error) {
    return res.status(403).json({ success: false, message: ERROR_MESSAGES.INVALID_TOKEN });
  }
});
