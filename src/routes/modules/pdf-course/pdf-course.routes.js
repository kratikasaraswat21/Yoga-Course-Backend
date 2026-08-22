import { UserValidateMiddleware } from "#src/middlewares/verify-user.middleware.js";
import { ValidateRequestParametersMiddleware } from "#src/middlewares/express-validator.middleware.js";
import {
  getPublishedPdfCourseDetailsController,
  getPublishedPdfCoursesController,
  getPurchasedPdfCoursesController,
  getPdfCourseAccessController,
  getTopLandingPdfCoursesController,
  getAllLandingPdfCoursesController,
} from "#src/routes/modules/pdf-course/pdf-course.controller.js";
import { Router } from "express";
import { param } from "express-validator";

const pdfCourseRoutes = Router();

pdfCourseRoutes.get("/", getPublishedPdfCoursesController);
pdfCourseRoutes.get("/top", getTopLandingPdfCoursesController);
pdfCourseRoutes.get("/all", getAllLandingPdfCoursesController);
pdfCourseRoutes.get("/explore", UserValidateMiddleware, getPublishedPdfCoursesController);
pdfCourseRoutes.get("/my-courses", UserValidateMiddleware, getPurchasedPdfCoursesController);
pdfCourseRoutes.get("/purchased", UserValidateMiddleware, getPurchasedPdfCoursesController);
pdfCourseRoutes.get(
  "/:pdfCourseId/access",
  UserValidateMiddleware,
  param("pdfCourseId").isUUID().withMessage("Valid PDF course ID is required"),
  ValidateRequestParametersMiddleware,
  getPdfCourseAccessController,
);
pdfCourseRoutes.get(
  "/:pdfCourseId",
  UserValidateMiddleware,
  param("pdfCourseId").isUUID().withMessage("Valid PDF course ID is required"),
  ValidateRequestParametersMiddleware,
  getPublishedPdfCourseDetailsController,
);

export default pdfCourseRoutes;
