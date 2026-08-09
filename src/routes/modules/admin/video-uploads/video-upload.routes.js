import { AdminValidateMiddleware } from "#src/middlewares/admin-validation.middleware.js";
import { ValidateRequestParametersMiddleware } from "#src/middlewares/express-validator.middleware.js";
import { CreateCloudflareVideoUploadUrlController } from "#src/routes/modules/admin/video-uploads/video-upload.controller.js";
import { Router } from "express";
import { body } from "express-validator";

const videoUploadRoutes = Router();

const MAX_VIDEO_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5 GB

const MAX_VIDEO_DURATION_SECONDS = 2 * 60 * 60; // 2 hours

videoUploadRoutes.post(
  "/upload-url",

  AdminValidateMiddleware,

  body("title")
    .trim()
    .notEmpty()
    .withMessage("Video title is required")
    .isLength({
      min: 2,
      max: 150,
    })
    .withMessage("Video title must contain between 2 and 150 characters"),

  body("fileName")
    .trim()
    .notEmpty()
    .withMessage("Video file name is required")
    .isLength({
      max: 255,
    })
    .withMessage("Video file name cannot exceed 255 characters"),

  body("fileType")
    .trim()
    .notEmpty()
    .withMessage("Video file type is required")
    .isIn(["video/mp4", "video/webm", "video/quicktime"])
    .withMessage("Only MP4, WebM and QuickTime videos are supported"),

  body("fileSize")
    .notEmpty()
    .withMessage("Video file size is required")
    .isInt({
      min: 1,
      max: MAX_VIDEO_FILE_SIZE,
    })
    .withMessage("Video file size must be between 1 byte and 5 GB")
    .toInt(),

  body("maxDurationSeconds")
    .notEmpty()
    .withMessage("Maximum video duration is required")
    .isInt({
      min: 1,
      max: MAX_VIDEO_DURATION_SECONDS,
    })
    .withMessage("Video duration must be between 1 second and 2 hours")
    .toInt(),
  ValidateRequestParametersMiddleware,
  CreateCloudflareVideoUploadUrlController,
);

export default videoUploadRoutes;
