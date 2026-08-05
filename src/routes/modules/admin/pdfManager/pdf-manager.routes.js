import { UserValidateMiddleware } from "#src/middlewares/verify-user.middleware.js";
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

pdfManager.post("/cloud/pdf/signature", UserValidateMiddleware, generatePdfUploadSignature);

pdfManager.post("/cloud/thumbnail/signature", UserValidateMiddleware, generatePdfThumbnailUploadSignature);

pdfManager.get("/fetch", UserValidateMiddleware, fetchAllPdfCourses);

pdfManager.put(
  "/reorder",
  body("orderedIds").isArray({ min: 1 }),
  body("courseId").optional().isString(),
  body("sortOrder").optional().isInt({ min: 1 }),
  UserValidateMiddleware,
  reorderPdfCoursesController,
);

pdfManager.delete("/delete", query("id")?.exists(), UserValidateMiddleware, deletePdfCourseController);

pdfManager.post(
  "/add",
  body("title")?.exists(),
  body("description")?.exists(),
  body("pdfFileName")?.exists(),
  body("fileUrl")?.exists(),
  body("thumbnailUrl")?.exists(),
  UserValidateMiddleware,
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
  UserValidateMiddleware,
  handelEditPdfCourseController,
);

export default pdfManager;
