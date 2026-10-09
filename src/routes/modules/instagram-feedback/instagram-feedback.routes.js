import { Router } from "express";

import { fetchPublicInstagramFeedbackImagesService } from "#src/routes/modules/admin/instagramFeedback/instagram-feedback.service.js";
import asyncHandler from "#src/utils/async-handler.util.js";

const instagramFeedbackRoutes = Router();

// Public: feedback screenshots for the home page and course landing pages, in the admin's order.
instagramFeedbackRoutes.get(
  "/",
  asyncHandler(async (req, res) => {
    const images = await fetchPublicInstagramFeedbackImagesService();
    return res.status(200).json({ success: true, message: "Feedback images fetched", data: { images } });
  }),
);

export default instagramFeedbackRoutes;
