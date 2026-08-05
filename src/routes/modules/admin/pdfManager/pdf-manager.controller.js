import { EnvConfig } from "#src/config/env.config.js";
import {
  addPdfCourseService,
  deletePdfCourseService,
  editPdfCourseService,
  fetchPdfCourse,
  reorderPdfCoursesService,
  signPdfCourseThumbnailService,
  signPdfFileService,
} from "#src/routes/modules/admin/pdfManager/pdf-manager.service.js";
import asyncHandler from "#src/utils/async-handler.util.js";
import { SUCCESS_MESSAGES } from "#src/utils/success.message.js";

export const generatePdfUploadSignature = asyncHandler(async (req, res) => {
  const timestamp = Math.floor(Date.now() / 1000);

  const pdfFolder = `yoga/courses/pdfs`;

  const pdfSignature = signPdfFileService(pdfFolder, timestamp);

  return res.status(200).json({
    message: SUCCESS_MESSAGES.FILE_SIGNED_SUCCESSFULLY,
    success: true,
    data: {
      cloudName: EnvConfig.CLOUDINARY_CLOUD_NAME,
      apiKey: EnvConfig.CLOUDINARY_API_KEY,
      timestamp,
      upload_info: {
        signature: pdfSignature,
        folder: pdfFolder,
        resourceType: "image",
      },
    },
  });
});

export const generatePdfThumbnailUploadSignature = asyncHandler(async (req, res) => {
  const timestamp = Math.floor(Date.now() / 1000);

  const thumbnailFolder = `yoga/courses/pdf-thumbnails`;

  const thumbnailSignature = signPdfCourseThumbnailService(thumbnailFolder, timestamp);

  return res.status(200).json({
    message: SUCCESS_MESSAGES.FILE_SIGNED_SUCCESSFULLY,
    success: true,
    data: {
      cloudName: EnvConfig.CLOUDINARY_CLOUD_NAME,
      apiKey: EnvConfig.CLOUDINARY_API_KEY,
      timestamp,
      upload_info: {
        signature: thumbnailSignature,
        folder: thumbnailFolder,
        resourceType: "image",
      },
    },
  });
});

export const handelAddPdfCourseController = asyncHandler(async (req, res) => {
  const title = req?.body?.title;
  const description = req?.body?.description;
  const pdfFileName = req?.body?.pdfFileName;
  const fileUrl = req?.body?.fileUrl;
  const thumbnailUrl = req?.body?.thumbnailUrl;
  const status = req?.body?.status;

  const response = await addPdfCourseService({
    title: title,
    description: description,
    status: status,
    pdfFileName: pdfFileName,
    fileUrl: fileUrl,
    thumbnailUrl: thumbnailUrl,
  });

  return res.status(200).json({
    message: SUCCESS_MESSAGES.PDF_COURSE_ADDED_SUCCESSFULLY,
    success: true,
  });
});

export const handelEditPdfCourseController = asyncHandler(async (req, res) => {
  const course_id = req?.query?.id;
  const title = req?.body?.title;
  const description = req?.body?.description;
  const pdfFileName = req?.body?.pdfFileName;
  const fileUrl = req?.body?.fileUrl;
  const thumbnailUrl = req?.body?.thumbnailUrl;
  const status = req?.body?.status;

  const response = await editPdfCourseService(
    {
      title: title,
      description: description,
      status: status,
      pdfFileName: pdfFileName,
      fileUrl: fileUrl,
      thumbnailUrl: thumbnailUrl,
    },
    course_id,
  );

  return res.status(200).json({
    message: SUCCESS_MESSAGES.PDF_COURSE_ADDED_SUCCESSFULLY,
    success: true,
  });
});

export const fetchAllPdfCourses = asyncHandler(async (req, res) => {
  const response = await fetchPdfCourse();

  return res.status(200).json({
    message: SUCCESS_MESSAGES.PDF_COURSE_FETCHED_SUCCESSFULLY,
    success: true,
    data: {
      pdf_courses: response,
    },
  });
});

export const deletePdfCourseController = asyncHandler(async (req, res) => {
  const course_id = req?.query?.id;
  const response = await deletePdfCourseService(course_id);

  return res.status(200).json({
    message: SUCCESS_MESSAGES.PDF_COURSE_DELETED_SUCCESSFULLY,
    success: true,
    data: {
      pdf_courses: response,
    },
  });
});

export const reorderPdfCoursesController = asyncHandler(async (req, res) => {
  const { courseId, orderedIds } = req.body ?? {};
  const pdfCourses = await reorderPdfCoursesService({ courseId, orderedIds });

  return res.status(200).json({
    message: "PDF courses reordered successfully",
    success: true,
    data: {
      pdf_courses: pdfCourses,
    },
  });
});
