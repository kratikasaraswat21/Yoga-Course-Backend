import { Router } from "express";
import { query } from "express-validator";

import { ValidateRequestParametersMiddleware } from "#src/middlewares/express-validator.middleware.js";
import { fetchPublicInstagramFeedbackImagesService } from "#src/routes/modules/admin/instagramFeedback/instagram-feedback.service.js";
import asyncHandler from "#src/utils/async-handler.util.js";

const instagramFeedbackRoutes = Router();

// Public: feedback screenshots in the admin's order. With `courseId`, that course's own images
// (or the global ones when it has none); without it, the global images for the home page.
instagramFeedbackRoutes.get(
  "/",
  query("courseId").optional({ values: "falsy" }).isUUID().withMessage("courseId must be a valid course ID"),
  ValidateRequestParametersMiddleware,
  asyncHandler(async (req, res) => {
    const images = await fetchPublicInstagramFeedbackImagesService(req.query?.courseId);
    return res.status(200).json({ success: true, message: "Feedback images fetched", data: { images } });
  }),
);

export default instagramFeedbackRoutes;
