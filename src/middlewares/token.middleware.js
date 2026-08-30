import asyncHandler from "#src/utils/async-handler.util.js";
import { ERROR_MESSAGES } from "#src/utils/error.messages.js";
import { prisma } from "#src/lib/prisma.js";
import jwt from "jsonwebtoken";

export const ValidateJWTToken = asyncHandler(async (req, res, next) => {
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

  const user = await prisma.user.findUnique({
    where: { id: verifiedData.id },
    select: { id: true },
  });

  if (!user) {
    return res.status(404).json({ success: false, message: ERROR_MESSAGES.USER_NOT_FOUND });
  }

  req.user = verifiedData;
  next();
});
