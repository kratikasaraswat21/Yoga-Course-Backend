import { AdminValidateMiddleware } from "#src/middlewares/admin-validation.middleware.js";
import { ValidateRequestParametersMiddleware } from "#src/middlewares/express-validator.middleware.js";
import {
  addCourseDataForStepOne,
  deleteCourseThumbnailController,
  deleteYogaCourseController,
  editCourseDetailsController,
  fetchAllCoursesController,
  fetchCourseDetailsController,
  fetchCourseStepOneController,
  generateCourseThumbnailUploadURL,
  getCourseLandingContentController,
  updateCourseLandingContentController,
  createCourseTrailerUploadController,
  deleteCourseTrailerController,
  getCourseAnalyticsController,
  publishCourseController,
  restoreCourseAccessController,
  revokeCourseAccessController,
} from "#src/routes/modules/admin/course/course.controller.js";
import { ERROR_MESSAGES } from "#src/utils/error.messages.js";
import { Router } from "express";
import { body, param } from "express-validator";

const courseRouter = Router();

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

// Optional fields shared by "add step one" and "edit": course URL slug and the prelaunch offer.
const courseSlugAndPrelaunchValidators = [
  body("slug")
    .optional({ values: "falsy" })
    .isString()
    .trim()
    .isLength({ max: 80 })
    .withMessage("Course URL can't be longer than 80 characters")
    .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .withMessage("Course URL can only contain lowercase letters, numbers and single hyphens"),
  body("sequentialUnlock").optional().isBoolean().withMessage("sequentialUnlock must be true or false"),
  body("prelaunchEnabled").optional().isBoolean().withMessage("prelaunchEnabled must be true or false"),
  body("prelaunchStartDate")
    .if(body("prelaunchEnabled").custom((value) => value === true || value === "true"))
    .matches(DATE_FORMAT)
    .withMessage("Prelaunch start date must be in YYYY-MM-DD format"),
  body("prelaunchEndDate")
    .if(body("prelaunchEnabled").custom((value) => value === true || value === "true"))
    .matches(DATE_FORMAT)
    .withMessage("Prelaunch end date must be in YYYY-MM-DD format"),
  body("prelaunchDiscount")
    .if(body("prelaunchEnabled").custom((value) => value === true || value === "true"))
    .isFloat({ gt: 0, max: 100 })
    .withMessage("Prelaunch discount must be more than 0% and at most 100%"),
];

const MAX_COURSE_THUMBNAIL_SIZE = 10 * 1024 * 1024;

courseRouter.post(
  "/cloud/thumbnail/upload-url",
  AdminValidateMiddleware,
  body("fileName")
    .trim()
    .notEmpty()
    .withMessage("Thumbnail file name is required")
    .isLength({ max: 255 })
    .withMessage("Thumbnail file name cannot exceed 255 characters"),

  body("fileType")
    .trim()
    .notEmpty()
    .withMessage("Thumbnail file type is required")
    // SVG is used for the landing page's stat tile icons.
    .isIn(["image/jpeg", "image/png", "image/webp", "image/svg+xml"])
    .withMessage("Only JPEG, PNG, WebP and SVG images are supported"),

  body("fileSize")
    .notEmpty()
    .withMessage("Thumbnail file size is required")
    .isInt({
      min: 1,
      max: MAX_COURSE_THUMBNAIL_SIZE,
    })
    .withMessage("Thumbnail file size must be between 1 byte and 10 MB")
    .toInt(),
  ValidateRequestParametersMiddleware,
  generateCourseThumbnailUploadURL,
);

courseRouter.delete(
  "/cloud/thumbnail/:imageId",

  AdminValidateMiddleware,

  param("imageId")
    .trim()
    .notEmpty()
    .withMessage("Cloudflare image ID is required")
    .isLength({
      min: 10,
      max: 255,
    })
    .withMessage("Invalid Cloudflare image ID"),

  ValidateRequestParametersMiddleware,

  deleteCourseThumbnailController,
);

courseRouter.post(
  "/add/step-one",
  AdminValidateMiddleware,
  body("title").trim().notEmpty().withMessage("Course title is required"),
  body("description").trim().notEmpty().withMessage("Course description is required").isLength({ max: 2500 }),
  body("price").trim().notEmpty().withMessage("Course prise is required"),
  body("discountPercentage").trim().notEmpty().withMessage("Course discount is required"),
  body("roundPayableAmount").isBoolean(),
  body("thumbnailURL").notEmpty().withMessage("Course Thumbnail Url is required"),
  body("thumbnailId").notEmpty().withMessage("Course Thumbnail Id is required"),
  ...courseSlugAndPrelaunchValidators,

  ValidateRequestParametersMiddleware,
  addCourseDataForStepOne,
);

courseRouter.post(
  "/edit/:courseId",
  AdminValidateMiddleware,
  param("courseId")
    .trim()
    .notEmpty()
    .withMessage("course ID is required For Editing The course")
    .isLength({
      min: 10,
      max: 255,
    })
    .withMessage("Invalid Cloudflare image ID"),
  body("title").trim().notEmpty().withMessage("Course title is required"),
  body("description").trim().notEmpty().withMessage("Course description is required").isLength({ max: 2500 }),
  body("price").trim().notEmpty().withMessage("Course prise is required"),
  body("discountPercentage").trim().notEmpty().withMessage("Course discount is required"),
  body("roundPayableAmount").isBoolean(),
  body("thumbnailURL").notEmpty().withMessage("Course Thumbnail Url is required"),
  body("thumbnailId").notEmpty().withMessage("Course Thumbnail Id is required"),
  ...courseSlugAndPrelaunchValidators,

  ValidateRequestParametersMiddleware,
  editCourseDetailsController,
);

courseRouter.get(
  "/fetch/course/details/:courseId",
  AdminValidateMiddleware,
  param("courseId").trim().notEmpty().withMessage(ERROR_MESSAGES.COURSE_ID_REQUIRED),
  ValidateRequestParametersMiddleware,
  fetchCourseDetailsController,
);

courseRouter.get("/fetch/all", AdminValidateMiddleware, fetchAllCoursesController);

courseRouter.get(
  "/analytics/:courseId",
  AdminValidateMiddleware,
  param("courseId").isUUID().withMessage("Valid course ID is required"),
  ValidateRequestParametersMiddleware,
  getCourseAnalyticsController,
);

courseRouter.post(
  "/:courseId/users/:userId/revoke-access",
  AdminValidateMiddleware,
  param("courseId").isUUID().withMessage("Valid course ID is required"),
  param("userId").isUUID().withMessage("Valid user ID is required"),
  body("reason")
    .trim()
    .notEmpty()
    .withMessage("A reason is required to revoke course access")
    .isLength({ min: 5, max: 1000 })
    .withMessage("The revocation reason must be between 5 and 1000 characters"),
  ValidateRequestParametersMiddleware,
  revokeCourseAccessController,
);

courseRouter.post(
  "/:courseId/users/:userId/restore-access",
  AdminValidateMiddleware,
  param("courseId").isUUID().withMessage("Valid course ID is required"),
  param("userId").isUUID().withMessage("Valid user ID is required"),
  ValidateRequestParametersMiddleware,
  restoreCourseAccessController,
);

courseRouter.delete(
  "/delete/:courseId",
  AdminValidateMiddleware,
  param("courseId").isUUID().withMessage("Valid course ID is required"),
  ValidateRequestParametersMiddleware,
  deleteYogaCourseController,
);

courseRouter.get(
  "/fetch/course/step-one/:courseId",
  AdminValidateMiddleware,
  param("courseId").trim().notEmpty().withMessage(ERROR_MESSAGES.COURSE_ID_REQUIRED),
  ValidateRequestParametersMiddleware,
  fetchCourseStepOneController,
);

courseRouter.get(
  "/:courseId/landing-content",
  AdminValidateMiddleware,
  param("courseId").isUUID().withMessage("Valid course ID is required"),
  ValidateRequestParametersMiddleware,
  getCourseLandingContentController,
);

courseRouter.put(
  "/:courseId/landing-content",
  AdminValidateMiddleware,
  param("courseId").isUUID().withMessage("Valid course ID is required"),
  body("landingPageEnabled").isBoolean().withMessage("landingPageEnabled must be true or false"),
  body("content").optional({ values: "null" }).isObject().withMessage("content must be an object"),
  body("trailerPosterUrl").optional({ values: "null" }).isString().withMessage("Trailer thumbnail URL must be text"),
  body("trailerPosterId").optional({ values: "null" }).isString().withMessage("Trailer thumbnail ID must be text"),
  ValidateRequestParametersMiddleware,
  updateCourseLandingContentController,
);

const MAX_TRAILER_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5 GB

courseRouter.post(
  "/:courseId/trailer/upload-url",
  AdminValidateMiddleware,
  param("courseId").isUUID().withMessage("Valid course ID is required"),
  body("fileName").trim().notEmpty().isLength({ max: 255 }).withMessage("Trailer file name is required"),
  body("fileType")
    .isIn(["video/mp4", "video/webm", "video/quicktime"])
    .withMessage("Only MP4, WebM and MOV trailers are supported"),
  body("fileSize")
    .isInt({ min: 1, max: MAX_TRAILER_FILE_SIZE })
    .withMessage("Trailer file size must be between 1 byte and 5 GB")
    .toInt(),
  body("maxDurationSeconds").isFloat({ min: 1 }).withMessage("Trailer duration is required").toFloat(),
  ValidateRequestParametersMiddleware,
  createCourseTrailerUploadController,
);

courseRouter.delete(
  "/:courseId/trailer",
  AdminValidateMiddleware,
  param("courseId").isUUID().withMessage("Valid course ID is required"),
  ValidateRequestParametersMiddleware,
  deleteCourseTrailerController,
);

courseRouter.patch(
  "/publish/:courseId",
  AdminValidateMiddleware,
  param("courseId").trim().notEmpty().withMessage(ERROR_MESSAGES.COURSE_ID_REQUIRED),
  ValidateRequestParametersMiddleware,
  publishCourseController,
);

export default courseRouter;
