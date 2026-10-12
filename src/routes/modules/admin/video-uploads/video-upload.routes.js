import { AdminValidateMiddleware } from "#src/middlewares/admin-validation.middleware.js";
import { ValidateRequestParametersMiddleware } from "#src/middlewares/express-validator.middleware.js";
import {
  CreateCloudflareVideoUploadUrlController,
  deleteVideoFromCloudflare,
  fetchYogaCourseVideosController,
  reorderCourseVideosController,
  updateVideoDetailsController,
  fetchCourseVideoGroupsController,
  createCourseVideoGroupController,
  updateCourseVideoGroupController,
  deleteCourseVideoGroupController,
  setGroupReleaseDateController,
  makeCourseLiveNowController,
} from "#src/routes/modules/admin/video-uploads/video-upload.controller.js";
import { Router } from "express";
import { body, param, query } from "express-validator";
import { ERROR_MESSAGES } from "#src/utils/error.messages.js";

const videoUploadRoutes = Router();

// Optional release date (YYYY-MM-DD, IST). Empty or null clears it. Range checks run in the service.
const releaseDateValidator = body("releaseDate")
  .optional({ values: "falsy" })
  .matches(/^\d{4}-\d{2}-\d{2}$/)
  .withMessage("Release date must be in YYYY-MM-DD format");

// Optional group (e.g. "Week 1"); empty means "no group". The service checks it belongs to the course.
const groupIdValidator = body("groupId").optional({ values: "null" }).isString().withMessage("groupId must be text");
const groupTitleValidator = body("title")
  .trim()
  .notEmpty()
  .withMessage("Group title is required")
  .isLength({ max: 120 })
  .withMessage("Group title can't be longer than 120 characters");
const groupDescriptionValidator = body("description")
  .optional({ values: "null" })
  .isString()
  .isLength({ max: 500 })
  .withMessage("Group description can't be longer than 500 characters");

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
    .isInt({ min: 1 })
    .withMessage(ERROR_MESSAGES.VIDEO_FILE_SIZE_INVALID)
    .toInt(),

  body("maxDurationSeconds")
    .notEmpty()
    .withMessage(ERROR_MESSAGES.VIDEO_MAX_DURATION_REQUIRED)
    .isFloat({ min: 1 })
    .withMessage(ERROR_MESSAGES.VIDEO_MAX_DURATION_INVALID)
    .toInt(),

  body("thumbnailType").notEmpty().withMessage(ERROR_MESSAGES.VIDEO_THUMBNAIL_TYPE_REQUIRED),
  releaseDateValidator,
  groupIdValidator,
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
  releaseDateValidator,
  groupIdValidator,
  ValidateRequestParametersMiddleware,
  updateVideoDetailsController,
);

videoUploadRoutes.put(
  "/reorder",
  AdminValidateMiddleware,
  body("courseId").isString().notEmpty(),
  // Either the old flat order (orderedIds) or the full layout with groups.
  body("orderedIds").if(body("layout").not().exists()).isArray({ min: 1 }),
  body("layout").optional().isArray({ min: 1 }),
  body("videoId").optional().isString(),
  ValidateRequestParametersMiddleware,
  reorderCourseVideosController,
);

videoUploadRoutes.get(
  "/groups",
  AdminValidateMiddleware,
  query("courseId").isUUID().withMessage(ERROR_MESSAGES.COURSE_ID_REQUIRED),
  ValidateRequestParametersMiddleware,
  fetchCourseVideoGroupsController,
);

videoUploadRoutes.post(
  "/groups",
  AdminValidateMiddleware,
  body("courseId").isUUID().withMessage(ERROR_MESSAGES.COURSE_ID_REQUIRED),
  groupTitleValidator,
  groupDescriptionValidator,
  ValidateRequestParametersMiddleware,
  createCourseVideoGroupController,
);

videoUploadRoutes.put(
  "/groups/:groupId",
  AdminValidateMiddleware,
  param("groupId").isUUID().withMessage("Valid group ID is required"),
  groupTitleValidator,
  groupDescriptionValidator,
  ValidateRequestParametersMiddleware,
  updateCourseVideoGroupController,
);

videoUploadRoutes.delete(
  "/groups/:groupId",
  AdminValidateMiddleware,
  param("groupId").isUUID().withMessage("Valid group ID is required"),
  ValidateRequestParametersMiddleware,
  deleteCourseVideoGroupController,
);

videoUploadRoutes.put(
  "/groups/:groupId/release-date",
  AdminValidateMiddleware,
  param("groupId").isUUID().withMessage("Valid group ID is required"),
  releaseDateValidator,
  ValidateRequestParametersMiddleware,
  setGroupReleaseDateController,
);

videoUploadRoutes.post(
  "/courses/:courseId/make-live",
  AdminValidateMiddleware,
  param("courseId").isUUID().withMessage(ERROR_MESSAGES.COURSE_ID_REQUIRED),
  ValidateRequestParametersMiddleware,
  makeCourseLiveNowController,
);

videoUploadRoutes.delete(
  "/delete/:videoId",
  AdminValidateMiddleware,
  param("videoId").notEmpty().withMessage(ERROR_MESSAGES.VIDEO_ID_REQUIRED),
  ValidateRequestParametersMiddleware,
  deleteVideoFromCloudflare,
);

export default videoUploadRoutes;
