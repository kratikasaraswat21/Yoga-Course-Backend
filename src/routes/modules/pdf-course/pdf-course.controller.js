import {
  getPublishedPdfCourseDetailsService,
  getPublishedPdfCoursesService,
  getPurchasedPdfCoursesService,
  getPdfCourseAccessService,
} from "#src/routes/modules/pdf-course/pdf-course.service.js";
import asyncHandler from "#src/utils/async-handler.util.js";

export const getPublishedPdfCoursesController = asyncHandler(async (req, res) => {
  const pdfCourses = await getPublishedPdfCoursesService(req.user?.id);
  return res.status(200).json({ success: true, message: "PDF courses fetched successfully", data: { pdfCourses } });
});

export const getPurchasedPdfCoursesController = asyncHandler(async (req, res) => {
  const pdfCourses = await getPurchasedPdfCoursesService(req.user.id);
  return res.status(200).json({ success: true, message: "Purchased PDF courses fetched successfully", data: { pdfCourses } });
});

export const getPublishedPdfCourseDetailsController = asyncHandler(async (req, res) => {
  const pdfCourse = await getPublishedPdfCourseDetailsService(req.params.pdfCourseId, req.user.id);
  return res.status(200).json({ success: true, message: "PDF course details fetched successfully", data: { pdfCourse } });
});

export const getPdfCourseAccessController = asyncHandler(async (req, res) => {
  const access = await getPdfCourseAccessService({ userId: req.user.id, pdfCourseId: req.params.pdfCourseId });
  return res.status(200).json({ success: true, message: "PDF course access granted", data: access });
});
