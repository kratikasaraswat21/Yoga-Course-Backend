import { EnvConfig } from "#src/config/env.config.js";
import { CourseStatus } from "#src/lib/enum.js";
import {
  addYogaCourseForStepOne,
  deleteThumbnailImageService,
  getYogaCourseDetailsService,
  getYogaCourseStepOneService,
  getCloudFlairImageUploadURL,
  fetchAllYogaCoursesService,
  getYogaCourseAnalyticsService,
  publishYogaCourseService,
  updateYogaCourseDetailsService,
  deleteYogaCourseService,
  getCourseLandingContentService,
  updateCourseLandingContentService,
  createCourseTrailerUploadService,
  deleteCourseTrailerService,
  revokeCourseAccessService,
  restoreCourseAccessService,
} from "#src/routes/modules/admin/course/course.service.js";
import asyncHandler from "#src/utils/async-handler.util.js";
import { calculatePayableAmount } from "#src/utils/course-pricing.util.js";
import { SUCCESS_MESSAGES } from "#src/utils/success.message.js";

const readBoolean = (value) => value === true || value === "true";

// Prelaunch fields are optional; when `prelaunchEnabled` is missing they are left unchanged.
const readPrelaunchInput = (body) =>
  body?.prelaunchEnabled === undefined
    ? undefined
    : {
        enabled: readBoolean(body.prelaunchEnabled),
        startDate: body.prelaunchStartDate,
        endDate: body.prelaunchEndDate,
        discount: body.prelaunchDiscount,
      };

// Optional; when it is missing the course keeps its current setting.
const readSequentialUnlockInput = (body) =>
  body?.sequentialUnlock === undefined ? undefined : readBoolean(body.sequentialUnlock);

const readSlugInput = (body) => (typeof body?.slug === "string" && body.slug.trim() ? body.slug.trim() : undefined);

export const generateCourseThumbnailUploadURL = asyncHandler(async (req, res) => {
  const { fileName, fileType } = req.body;

  if (!EnvConfig.CLOUDFLARE_ACCOUNT_ID || !EnvConfig.CLOUDFLARE_IMAGES_API_TOKEN) {
    throw new Error("Cloudflare Images configuration is missing");
  }

  const formData = new FormData();

  formData.append("requireSignedURLs", "false");

  formData.append(
    "metadata",
    JSON.stringify({
      type: "COURSE_THUMBNAIL",
      fileName,
      fileType,
    }),
  );

  const response = await getCloudFlairImageUploadURL({ formData });

  return res.status(201).json({
    success: true,

    message: SUCCESS_MESSAGES.COURSE_THUMBNAIL_UPLOAD_URL_GENERATED_SUCCESSFULLY,

    data: {
      imageId: response.imageId,
      uploadUrl: response.uploadUrl,
    },
  });
});

export const deleteCourseThumbnailController = asyncHandler(async (req, res) => {
  const { imageId } = req.params;

  if (!EnvConfig.CLOUDFLARE_ACCOUNT_ID || !EnvConfig.CLOUDFLARE_IMAGES_API_TOKEN) {
    throw new Error("Cloudflare Images configuration is missing");
  }

  const encodedImageId = encodeURIComponent(imageId);

  const response = await deleteThumbnailImageService({ encodedImageId, imageId });

  return res.status(200).json({
    success: true,
    message: SUCCESS_MESSAGES.COURSE_THUMBNAIL_DELETED_SUCCESSFULLY,
    data: response,
  });
});

export const addCourseDataForStepOne = asyncHandler(async (req, res) => {
  const title = req?.body?.title;
  const description = req?.body?.description;
  const price = req?.body?.price;
  const discountPercentage = req?.body?.discountPercentage;
  const roundPayableAmount = req?.body?.roundPayableAmount;
  const thumbnailUrl = req?.body?.thumbnailURL;
  const thumbnailId = req?.body?.thumbnailId;

  const coursePrice = Number(price);
  const courseDiscountPercentage = Number(discountPercentage);
  const shouldRoundPayableAmount = readBoolean(roundPayableAmount);
  const totalPayableAmount = calculatePayableAmount(coursePrice, courseDiscountPercentage, shouldRoundPayableAmount);

  const courseObject = await addYogaCourseForStepOne({
    title,
    slug: readSlugInput(req.body),
    description,
    price: coursePrice,
    discount: courseDiscountPercentage,
    totalPayableAmount: totalPayableAmount,
    roundPayableAmount: shouldRoundPayableAmount,
    prelaunch: readPrelaunchInput(req.body),
    sequentialUnlock: readSequentialUnlockInput(req.body),
    thumbnailId,
    thumbnailUrl,
  });

  return res.status(200).json({
    success: true,
    message: SUCCESS_MESSAGES.COURSE_STEP_ONE_SAVED_SUCCESSFULLY,
    data: {
      course_id: courseObject.id,
      slug: courseObject.slug,
    },
  });
});

export const editCourseDetailsController = asyncHandler(async (req, res) => {
  const { courseId } = req.params;

  const title = req?.body?.title;
  const description = req?.body?.description;
  const price = req?.body?.price;
  const discountPercentage = req?.body?.discountPercentage;
  const roundPayableAmount = req?.body?.roundPayableAmount;
  const thumbnailUrl = req?.body?.thumbnailURL;
  const thumbnailId = req?.body?.thumbnailId;
  const status = req?.body?.status ?? CourseStatus.DRAFT;
  const coursePrice = Number(price);
  const courseDiscountPercentage = Number(discountPercentage);
  const shouldRoundPayableAmount = readBoolean(roundPayableAmount);
  const totalPayableAmount = calculatePayableAmount(coursePrice, courseDiscountPercentage, shouldRoundPayableAmount);

  const courseObject = await updateYogaCourseDetailsService(courseId, {
    title,
    slug: readSlugInput(req.body),
    description,
    price: coursePrice,
    discount: courseDiscountPercentage,
    totalPayableAmount: totalPayableAmount,
    roundPayableAmount: shouldRoundPayableAmount,
    prelaunch: readPrelaunchInput(req.body),
    sequentialUnlock: readSequentialUnlockInput(req.body),
    thumbnailId,
    thumbnailUrl,
  });

  return res.status(200).json({
    success: true,
    message: SUCCESS_MESSAGES.COURSE_DETAILS_UPDATED_SUCCESSFULLY,
    data: {
      course_id: courseObject.id,
      slug: courseObject.slug,
    },
  });
});

export const fetchCourseDetailsController = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const course = await getYogaCourseDetailsService(courseId);

  return res.status(200).json({
    success: true,
    message: "Course details fetched successfully",
    data: {
      course,
    },
  });
});

export const fetchCourseStepOneController = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const course = await getYogaCourseStepOneService(courseId);

  return res.status(200).json({
    success: true,
    message: SUCCESS_MESSAGES.COURSE_STEP_ONE_FETCHED_SUCCESSFULLY,
    data: {
      course,
    },
  });
});

export const publishCourseController = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const result = await publishYogaCourseService(courseId);

  if (!result.success) {
    return res.status(result.statusCode).json({
      success: false,
      message: result.message,
    });
  }

  return res.status(200).json({
    success: true,
    message: SUCCESS_MESSAGES.COURSE_PUBLISHED_SUCCESSFULLY,
    data: {
      course: result.course,
    },
  });
});

export const fetchAllCoursesController = asyncHandler(async (req, res) => {
  const courses = await fetchAllYogaCoursesService();

  return res.status(200).json({
    success: true,
    message: SUCCESS_MESSAGES.COURSES_FETCHED_SUCCESSFULLY,
    data: {
      courses,
    },
  });
});

export const getCourseAnalyticsController = asyncHandler(async (req, res) => {
  const analytics = await getYogaCourseAnalyticsService(req.params.courseId);

  return res.status(200).json({
    success: true,
    message: "Course analytics fetched successfully",
    data: analytics,
  });
});

export const deleteYogaCourseController = asyncHandler(async (req, res) => {
  const result = await deleteYogaCourseService(req.params.courseId);

  return res.status(200).json({
    success: true,
    message: "Course and all associated assets deleted successfully",
    data: result,
  });
});

export const revokeCourseAccessController = asyncHandler(async (req, res) => {
  const enrollment = await revokeCourseAccessService({
    courseId: req.params.courseId,
    userId: req.params.userId,
    reason: req.body.reason.trim(),
  });

  return res.status(200).json({
    success: true,
    message: "Course access revoked successfully",
    data: { enrollment },
  });
});

export const restoreCourseAccessController = asyncHandler(async (req, res) => {
  const enrollment = await restoreCourseAccessService({
    courseId: req.params.courseId,
    userId: req.params.userId,
  });

  return res.status(200).json({
    success: true,
    message: "Course access restored successfully",
    data: { enrollment },
  });
});

export const getCourseLandingContentController = asyncHandler(async (req, res) => {
  const landingPage = await getCourseLandingContentService(req.params.courseId);

  return res.status(200).json({
    success: true,
    message: "Course landing page fetched successfully",
    data: { landingPage },
  });
});

export const updateCourseLandingContentController = asyncHandler(async (req, res) => {
  const landingPage = await updateCourseLandingContentService(req.params.courseId, req.body ?? {});

  return res.status(200).json({
    success: true,
    message: "Course landing page saved successfully",
    data: { landingPage },
  });
});

export const createCourseTrailerUploadController = asyncHandler(async (req, res) => {
  const upload = await createCourseTrailerUploadService({
    courseId: req.params.courseId,
    fileName: req.body.fileName,
    fileType: req.body.fileType,
    fileSize: req.body.fileSize,
    maxDurationSeconds: req.body.maxDurationSeconds,
  });

  return res.status(201).json({
    success: true,
    message: "Trailer upload URL created successfully",
    data: upload,
  });
});

export const deleteCourseTrailerController = asyncHandler(async (req, res) => {
  const result = await deleteCourseTrailerService(req.params.courseId);

  return res.status(200).json({
    success: true,
    message: "Trailer deleted successfully",
    data: result,
  });
});
