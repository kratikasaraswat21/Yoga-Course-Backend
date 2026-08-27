import asyncHandler from "#src/utils/async-handler.util.js";
import { ERROR_MESSAGES } from "#src/utils/error.messages.js";
import { validationResult } from "express-validator";

export const ValidateRequestParametersMiddleware = asyncHandler(async (req, res, next) => {
  try {
    const result = validationResult(req);

    if (!result.isEmpty()) {
      return res.status(400).json({
        message: ERROR_MESSAGES.VALIDATION_ERROR,
        success: false,
        errors: result.array(),
      });
    }

    next();
  } catch (error) {
    return res.status(403).json({ message: ERROR_MESSAGES.INVALID_TOKEN, success: false });
  }
});
