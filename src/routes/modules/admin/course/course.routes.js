import { AdminValidateMiddleware } from "#src/middlewares/admin-validation.middleware.js";
import { ValidateRequestParametersMiddleware } from "#src/middlewares/express-validator.middleware.js";
import {
  addCourseDataForStepOne,
  deleteCourseThumbnailController,
  editCourseDetailsController,
  fetchCourseDetailsController,
  fetchCourseStepOneController,
  fetchAllCoursesController,
  getCourseAnalyticsController,
  generateCourseThumbnailUploadURL,
  publishCourseController,
  deleteYogaCourseController,
  revokeCourseAccessController,
  restoreCourseAccessController,
} from "#src/routes/modules/admin/course/course.controller.js";
import { ERROR_MESSAGES } from "#src/utils/error.messages.js";
import { Router } from "express";
import { body, param } from "express-validator";

const courseRouter = Router();

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
    .isIn(["image/jpeg", "image/png", "image/webp"])
    .withMessage("Only JPEG, PNG and WebP thumbnails are supported"),

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
  body("discountPercentage")
    .trim()
    .notEmpty()
    .withMessage("Course discount is required")
    .toInt()
    .isInt({ min: 0, max: 100 })
    .withMessage("Course discount range should be between 0% to 100% is required"),
  body("roundPayableAmount").isBoolean(),
  body("thumbnailURL").notEmpty().withMessage("Course Thumbnail Url is required"),
  body("thumbnailId").notEmpty().withMessage("Course Thumbnail Id is required"),

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
  body("discountPercentage")
    .trim()
    .notEmpty()
    .withMessage("Course discount is required")
    .toInt()
    .isInt({ min: 0, max: 100 })
    .withMessage("Course discount range should be between 0% to 100% is required"),
  body("roundPayableAmount").isBoolean(),
  body("thumbnailURL").notEmpty().withMessage("Course Thumbnail Url is required"),
  body("thumbnailId").notEmpty().withMessage("Course Thumbnail Id is required"),

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

courseRouter.get(
  "/fetch/all",
  AdminValidateMiddleware,
  fetchAllCoursesController,
);

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

courseRouter.patch(
  "/publish/:courseId",
  AdminValidateMiddleware,
  param("courseId").trim().notEmpty().withMessage(ERROR_MESSAGES.COURSE_ID_REQUIRED),
  ValidateRequestParametersMiddleware,
  publishCourseController,
);

export default courseRouter;
