import asyncHandler from "#src/utils/async-handler.util.js";
import { ERROR_MESSAGES } from "#src/utils/error.messages.js";
import jwt from "jsonwebtoken";

export const ValidateJWTToken = asyncHandler(async (req, res, next) => {
  // Express normalizes incoming header names to lowercase.
  const authHeader = req.headers.authorization;

  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ success: false, message: ERROR_MESSAGES.ACCESS_DENIED });
  }

  try {
    const verifiedData = jwt.verify(token, process.env.JWT_SECRET);

    req.user = verifiedData;

    next();
  } catch (error) {
    return res.status(403).json({ message: ERROR_MESSAGES.INVALID_TOKEN, success: false });
  }
});
