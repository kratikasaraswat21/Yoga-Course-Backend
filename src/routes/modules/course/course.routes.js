import { ValidateRequestParametersMiddleware } from "#src/middlewares/express-validator.middleware.js";
import { OptionalUserMiddleware } from "#src/middlewares/optional-user.middleware.js";
import { UserValidateMiddleware } from "#src/middlewares/verify-user.middleware.js";
import {
  getCourseVideoPlaybackController,
  getPublishedCourseDetailsController,
  getPublishedCoursesController,
  getPublishedCourseVideosController,
  getOtherCourseVideosController,
  getPurchasedCoursesController,
  createCourseReviewController,
  createCourseVideoRatingController,
  completeCourseVideoController,
} from "#src/routes/modules/course/course.controller.js";
import { Router } from "express";
import { param } from "express-validator";

const courseRoutes = Router();

courseRoutes.get("/", OptionalUserMiddleware, getPublishedCoursesController);
courseRoutes.get("/my-courses", UserValidateMiddleware, getPurchasedCoursesController);

courseRoutes.post(
  "/:courseId/review",
  UserValidateMiddleware,
  param("courseId").isUUID().withMessage("Valid course ID is required"),
  ValidateRequestParametersMiddleware,
  createCourseReviewController,
);

courseRoutes.post(
  "/:courseId/videos/:videoId/rating",
  UserValidateMiddleware,
  param("courseId").isUUID().withMessage("Valid course ID is required"),
  param("videoId").isUUID().withMessage("Valid video ID is required"),
  ValidateRequestParametersMiddleware,
  createCourseVideoRatingController,
);

courseRoutes.post(
  "/:courseId/videos/:videoId/complete",
  UserValidateMiddleware,
  param("courseId").isUUID().withMessage("Valid course ID is required"),
  param("videoId").isUUID().withMessage("Valid video ID is required"),
  ValidateRequestParametersMiddleware,
  completeCourseVideoController,
);

courseRoutes.get(
  "/:courseId",
  UserValidateMiddleware,
  param("courseId").isUUID().withMessage("Valid course ID is required"),
  ValidateRequestParametersMiddleware,
  getPublishedCourseDetailsController,
);

courseRoutes.get(
  "/:courseId/videos/:videoId/others",
  UserValidateMiddleware,
  param("courseId").isUUID().withMessage("Valid course ID is required"),
  param("videoId").isUUID().withMessage("Valid video ID is required"),
  ValidateRequestParametersMiddleware,
  getOtherCourseVideosController,
);

courseRoutes.get(
  "/:courseId/videos/:videoId/playback",
  UserValidateMiddleware,
  param("courseId").isUUID().withMessage("Valid course ID is required"),
  param("videoId").isUUID().withMessage("Valid video ID is required"),
  ValidateRequestParametersMiddleware,
  getCourseVideoPlaybackController,
);

courseRoutes.get(
  "/:courseId/videos",
  UserValidateMiddleware,
  param("courseId").isUUID().withMessage("Valid course ID is required"),
  ValidateRequestParametersMiddleware,
  getPublishedCourseVideosController,
);

export default courseRoutes;
