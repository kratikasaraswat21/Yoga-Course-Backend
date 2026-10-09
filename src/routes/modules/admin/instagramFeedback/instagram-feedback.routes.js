import { Router } from "express";
import { body, query } from "express-validator";

import { AdminValidateMiddleware } from "#src/middlewares/admin-validation.middleware.js";
import { ValidateRequestParametersMiddleware } from "#src/middlewares/express-validator.middleware.js";
import {
  addInstagramFeedbackImageController,
  deleteInstagramFeedbackImageController,
  fetchInstagramFeedbackImagesController,
  generateInstagramFeedbackUploadSignature,
  reorderInstagramFeedbackImagesController,
} from "#src/routes/modules/admin/instagramFeedback/instagram-feedback.controller.js";

const instagramFeedbackAdminRoutes = Router();

instagramFeedbackAdminRoutes.post("/cloud/signature", AdminValidateMiddleware, generateInstagramFeedbackUploadSignature);

instagramFeedbackAdminRoutes.get("/fetch", AdminValidateMiddleware, fetchInstagramFeedbackImagesController);

instagramFeedbackAdminRoutes.post(
  "/add",
  AdminValidateMiddleware,
  body("imageUrl").isString().withMessage("imageUrl is required"),
  body("publicId").isString().withMessage("publicId is required"),
  body("altText").optional({ values: "null" }).isString().withMessage("altText must be text"),
  ValidateRequestParametersMiddleware,
  addInstagramFeedbackImageController,
);

instagramFeedbackAdminRoutes.put(
  "/reorder",
  AdminValidateMiddleware,
  body("orderedIds").isArray({ min: 1 }).withMessage("orderedIds must list the image IDs"),
  ValidateRequestParametersMiddleware,
  reorderInstagramFeedbackImagesController,
);

instagramFeedbackAdminRoutes.delete(
  "/delete",
  AdminValidateMiddleware,
  query("id").isUUID().withMessage("A valid image ID is required"),
  ValidateRequestParametersMiddleware,
  deleteInstagramFeedbackImageController,
);

export default instagramFeedbackAdminRoutes;
