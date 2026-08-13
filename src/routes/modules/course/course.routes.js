import { ValidateRequestParametersMiddleware } from "#src/middlewares/express-validator.middleware.js";
import { UserValidateMiddleware } from "#src/middlewares/verify-user.middleware.js";
import {
  getCourseVideoPlaybackController,
  getPublishedCourseDetailsController,
  getPublishedCoursesController,
  getPublishedCourseVideosController,
  getOtherCourseVideosController,
  getPurchasedCoursesController,
} from "#src/routes/modules/course/course.controller.js";
import { Router } from "express";
import { param } from "express-validator";

const courseRoutes = Router();

courseRoutes.get("/", getPublishedCoursesController);
courseRoutes.get("/my-courses", UserValidateMiddleware, getPurchasedCoursesController);

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
