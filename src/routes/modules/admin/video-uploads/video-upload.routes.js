import { AdminValidateMiddleware } from "#src/middlewares/admin-validation.middleware.js";
import { ValidateRequestParametersMiddleware } from "#src/middlewares/express-validator.middleware.js";
import {
  CreateCloudflareVideoUploadUrlController,
  deleteVideoFromCloudflare,
  fetchYogaCourseVideosController,
  reorderCourseVideosController,
  updateVideoDetailsController,
} from "#src/routes/modules/admin/video-uploads/video-upload.controller.js";
import { Router } from "express";
import { body, param, query } from "express-validator";
import { ERROR_MESSAGES } from "#src/utils/error.messages.js";

const videoUploadRoutes = Router();

const MAX_VIDEO_FILE_SIZE = 50 * 1024 * 1024 * 1024; // 50 GB

const MAX_VIDEO_DURATION_SECONDS = 2 * 60 * 60; // 2 hours

videoUploadRoutes.post(
  "/upload-url",

  AdminValidateMiddleware,

  body("courseId")
    .trim()
    .notEmpty()
    .withMessage(ERROR_MESSAGES.COURSE_ID_REQUIRED)
    .isLength({
      min: 2,
      max: 150,
    })
    .withMessage(ERROR_MESSAGES.VIDEO_TITLE_LENGTH_INVALID),

  body("title")
    .trim()
    .notEmpty()
    .withMessage(ERROR_MESSAGES.VIDEO_TITLE_REQUIRED)
    .isLength({
      min: 2,
      max: 150,
    })
    .withMessage(ERROR_MESSAGES.VIDEO_TITLE_LENGTH_INVALID),

  body("fileName")
    .trim()
    .notEmpty()
    .withMessage(ERROR_MESSAGES.VIDEO_FILE_NAME_REQUIRED)
    .isLength({
      max: 255,
    })
    .withMessage(ERROR_MESSAGES.VIDEO_FILE_NAME_LENGTH_INVALID),

  body("fileType")
    .trim()
    .notEmpty()
    .withMessage(ERROR_MESSAGES.VIDEO_FILE_TYPE_REQUIRED)
    .isIn(["video/mp4", "video/webm", "video/quicktime"])
    .withMessage(ERROR_MESSAGES.VIDEO_FILE_TYPE_INVALID),

  body("fileSize")
    .notEmpty()
    .withMessage(ERROR_MESSAGES.VIDEO_FILE_SIZE_REQUIRED)
    .isInt({
      min: 1,
      max: MAX_VIDEO_FILE_SIZE,
    })
    .withMessage(ERROR_MESSAGES.VIDEO_FILE_SIZE_INVALID)
    .toInt(),

  body("maxDurationSeconds")
    .notEmpty()
    .withMessage(ERROR_MESSAGES.VIDEO_MAX_DURATION_REQUIRED)
    .isFloat({
      min: 1,
      max: MAX_VIDEO_DURATION_SECONDS,
    })
    .withMessage(ERROR_MESSAGES.VIDEO_MAX_DURATION_INVALID(MAX_VIDEO_DURATION_SECONDS))
    .toInt(),

  body("thumbnailType").notEmpty().withMessage(ERROR_MESSAGES.VIDEO_THUMBNAIL_TYPE_REQUIRED),
  ValidateRequestParametersMiddleware,
  CreateCloudflareVideoUploadUrlController,
);
videoUploadRoutes.get(
  "/fetch",
  AdminValidateMiddleware,
  query("courseId").notEmpty().withMessage(ERROR_MESSAGES.COURSE_ID_REQUIRED),
  ValidateRequestParametersMiddleware,
  fetchYogaCourseVideosController,
);

videoUploadRoutes.put(
  "/edit",
  AdminValidateMiddleware,
  body("videoId").trim().notEmpty().withMessage(ERROR_MESSAGES.VIDEO_ID_REQUIRED),
  body("title")
    .trim()
    .notEmpty()
    .withMessage(ERROR_MESSAGES.VIDEO_TITLE_REQUIRED)
    .isLength({ min: 2, max: 150 })
    .withMessage(ERROR_MESSAGES.VIDEO_TITLE_LENGTH_INVALID),
  body("description")
    .optional()
    .isString()
    .isLength({ max: 2500 })
    .withMessage("Video description cannot exceed 2500 characters"),
  body("thumbnailId").trim().notEmpty().withMessage("Video thumbnail ID is required"),
  body("thumbnailUrl").trim().notEmpty().withMessage("Video thumbnail URL is required"),
  ValidateRequestParametersMiddleware,
  updateVideoDetailsController,
);

videoUploadRoutes.put(
  "/reorder",
  body("courseId").isString().notEmpty(),
  body("orderedIds").isArray({ min: 1 }),
  body("videoId").optional().isString(),
  ValidateRequestParametersMiddleware,
  AdminValidateMiddleware,
  reorderCourseVideosController,
);

videoUploadRoutes.delete(
  "/delete/:videoId",
  AdminValidateMiddleware,
  param("videoId").notEmpty().withMessage(ERROR_MESSAGES.VIDEO_ID_REQUIRED),
  ValidateRequestParametersMiddleware,
  deleteVideoFromCloudflare,
);

export default videoUploadRoutes;
