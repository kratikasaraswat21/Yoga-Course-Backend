import { AdminValidateMiddleware } from "#src/middlewares/admin-validation.middleware.js";
import { ValidateRequestParametersMiddleware } from "#src/middlewares/express-validator.middleware.js";
import {
  deletePdfCourseController,
  fetchAllPdfCourses,
  generatePdfThumbnailUploadSignature,
  generatePdfUploadSignature,
  handelAddPdfCourseController,
  handelEditPdfCourseController,
  reorderPdfCoursesController,
} from "#src/routes/modules/admin/pdfManager/pdf-manager.controller.js";
import { Router } from "express";
import { body, query } from "express-validator";

const pdfManager = Router();

pdfManager.post("/cloud/pdf/signature", AdminValidateMiddleware, generatePdfUploadSignature);

pdfManager.post("/cloud/thumbnail/signature", AdminValidateMiddleware, generatePdfThumbnailUploadSignature);

pdfManager.get("/fetch", AdminValidateMiddleware, fetchAllPdfCourses);

pdfManager.put(
  "/reorder",
  body("orderedIds").isArray({ min: 1 }),
  body("courseId").optional().isString(),
  body("sortOrder").optional().isInt({ min: 1 }),
  ValidateRequestParametersMiddleware,
  AdminValidateMiddleware,
  reorderPdfCoursesController,
);

pdfManager.delete(
  "/delete",
  query("id")?.exists(),
  ValidateRequestParametersMiddleware,
  AdminValidateMiddleware,
  deletePdfCourseController,
);

pdfManager.post(
  "/add",
  body("title")?.exists(),
  body("description")?.exists(),
  body("pdfFileName")?.exists(),
  body("fileUrl")?.exists(),
  body("thumbnailUrl")?.exists(),
  body("price")?.exists(),
  body("discount")?.exists(),
  body("totalPayableAmount")?.exists(),
  body("isAvailableForFree")?.exists(),
  ValidateRequestParametersMiddleware,
  AdminValidateMiddleware,
  handelAddPdfCourseController,
);

pdfManager.post(
  "/edit",
  query("id")?.exists(),
  body("title")?.exists(),
  body("description")?.exists(),
  body("pdfFileName")?.exists(),
  body("fileUrl")?.exists(),
  body("thumbnailUrl")?.exists(),
  body("price")?.exists(),
  body("discount")?.exists(),
  body("totalPayableAmount")?.exists(),
  body("isAvailableForFree")?.exists(),
  ValidateRequestParametersMiddleware,
  AdminValidateMiddleware,
  handelEditPdfCourseController,
);

export default pdfManager;
