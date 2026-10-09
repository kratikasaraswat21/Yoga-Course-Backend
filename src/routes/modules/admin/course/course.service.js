import { EnvConfig } from "#src/config/env.config.js";
import { CourseStatus } from "#src/lib/enum.js";
import { prisma } from "#src/lib/prisma.js";
import { ERROR_MESSAGES } from "#src/utils/error.messages.js";
import { deleteYogaCourseVideoFromCloudFlair } from "#src/routes/modules/admin/video-uploads/video-upload.service.js";
import { SendEmailNotificationService } from "#src/email/email.service.js";
import { calculatePayableAmount, getPrelaunchState } from "#src/utils/course-pricing.util.js";
import { addDaysToIstDate, getIstToday, istDateToUtc, isValidIstDateString, utcToIstDate } from "#src/utils/ist-date.util.js";
import { revalidateCoursePages } from "#src/utils/landing-revalidate.util.js";
import { ensureAvailableCourseSlug, generateUniqueCourseSlug } from "#src/utils/slug.util.js";
import { formatLandingContent, getLandingContentImageIds, sanitizeLandingContentInput } from "#src/utils/course-landing.util.js";
import { encodeMetadata } from "#src/utils/helper.js";
import { groupCourseVideos, videoGroupSelect } from "#src/utils/course-video-group.util.js";

const isValidCloudflareImageId = (imageId) => Boolean(imageId && imageId !== "-");

const deleteCloudflareImageIfPresent = async (imageId) => {
  try {
    return await deleteThumbnailImageService({ encodedImageId: encodeURIComponent(imageId), imageId });
  } catch (error) {
    // The database can contain an image ID that was already deleted in Cloudflare.
    if (error.statusCode === 404 || error.message === "Image not found") return null;
    throw error;
  }
};

export const getCloudFlairImageUploadURL = async ({ formData }) => {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/` + `${EnvConfig.CLOUDFLARE_ACCOUNT_ID}/images/v2/direct_upload`,
    {
      method: "POST",

      headers: {
        Authorization: `Bearer ${EnvConfig.CLOUDFLARE_IMAGES_API_TOKEN}`,
      },

      body: formData,
    },
  );

  const responseData = await response.json();

  if (!response.ok || !responseData.success || !responseData.result?.id || !responseData.result.uploadURL) {
    throw new Error(responseData.errors?.[0]?.message ?? "Unable to initialize course thumbnail upload");
  }

  return {
    imageId: responseData.result.id,
    uploadUrl: responseData.result.uploadURL,
  };
};

export const deleteThumbnailImageService = async ({ encodedImageId, imageId }) => {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/` +
      `${EnvConfig.CLOUDFLARE_ACCOUNT_ID}/images/v1/` +
      `${encodedImageId}`,
    {
      method: "DELETE",

      headers: {
        Authorization: `Bearer ${EnvConfig.CLOUDFLARE_IMAGES_API_TOKEN}`,
      },
    },
  );

  const responseData = await response.json();

  if (!response.ok || !responseData.success) {
    throw new Error(responseData.errors?.[0]?.message ?? "Unable to delete course thumbnail");
  }

  return {
    imageId,
    deleted: true,
  };
};

const badRequest = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

// The prelaunch offer can run for at most this many days (end date - start date).
export const MAX_PRELAUNCH_DAYS = 20;

const PRELAUNCH_CLEARED = {
  prelaunchEnabled: false,
  prelaunchStartAt: null,
  prelaunchEndAt: null,
  prelaunchDiscount: 0,
  prelaunchPayableAmount: 0,
};

/**
 * Validates the prelaunch fields sent by the admin form and returns the columns to save.
 * Returns undefined when the request didn't include prelaunch fields, so they stay unchanged.
 * Dates are whole days in IST; the offer starts at 00:00 IST on the start date and ends at
 * 00:00 IST on the end date.
 */
const buildPrelaunchData = ({ prelaunch, price, roundPayableAmount, existingCourse }) => {
  if (prelaunch?.enabled === undefined) {
    if (!existingCourse?.prelaunchEnabled) return undefined;

    // Price or rounding changed: keep the prelaunch price in line with the new course price.
    const prelaunchPayableAmount = calculatePayableAmount(price, existingCourse.prelaunchDiscount, roundPayableAmount);
    return prelaunchPayableAmount > 0 ? { prelaunchPayableAmount } : undefined;
  }

  if (!prelaunch.enabled) return PRELAUNCH_CLEARED;

  const { startDate, endDate } = prelaunch;
  const discount = Number(prelaunch.discount);

  if (!isValidIstDateString(startDate)) throw badRequest("Prelaunch start date is required (YYYY-MM-DD)");
  if (!isValidIstDateString(endDate)) throw badRequest("Prelaunch end date is required (YYYY-MM-DD)");
  if (endDate <= startDate) throw badRequest("Prelaunch end date must be after the start date");
  if (endDate > addDaysToIstDate(startDate, MAX_PRELAUNCH_DAYS)) {
    throw badRequest(`The prelaunch offer can run for at most ${MAX_PRELAUNCH_DAYS} days`);
  }

  const today = getIstToday();
  const existingStartDate = utcToIstDate(existingCourse?.prelaunchStartAt);
  const existingEndDate = utcToIstDate(existingCourse?.prelaunchEndAt);

  // A prelaunch that already started can keep its start date; a new or changed start date can't be in the past.
  if (startDate < today && startDate !== existingStartDate) {
    throw badRequest("Prelaunch start date can't be in the past");
  }
  if (endDate <= today && endDate !== existingEndDate) {
    throw badRequest("Prelaunch end date must be after today");
  }

  if (!Number.isFinite(discount) || discount <= 0 || discount > 100) {
    throw badRequest("Prelaunch discount must be more than 0% and at most 100%");
  }

  const prelaunchPayableAmount = calculatePayableAmount(price, discount, roundPayableAmount);
  if (!(prelaunchPayableAmount > 0)) {
    throw badRequest("The prelaunch price must be more than ₹0. Lower the prelaunch discount.");
  }

  return {
    prelaunchEnabled: true,
    prelaunchStartAt: istDateToUtc(startDate),
    prelaunchEndAt: istDateToUtc(endDate),
    prelaunchDiscount: discount,
    prelaunchPayableAmount,
  };
};

export const addYogaCourseForStepOne = async ({
  title,
  slug,
  description,
  price,
  discount,
  totalPayableAmount,
  roundPayableAmount,
  prelaunch,
  sequentialUnlock,
  thumbnailUrl,
  thumbnailId,
}) => {
  const courseSlug = slug ? await ensureAvailableCourseSlug(slug) : await generateUniqueCourseSlug(title);
  const prelaunchData = buildPrelaunchData({ prelaunch, price, roundPayableAmount, existingCourse: null });

  const course = await prisma.yogaCourse.create({
    data: {
      title,
      slug: courseSlug,
      description,
      status: CourseStatus.DRAFT,
      price,
      discount,
      totalPayableAmount,
      ...(prelaunchData ?? {}),
      sequentialUnlock: sequentialUnlock === true,
      thumbnailUrl,
      thumbnailId,
    },
  });

  revalidateCoursePages(course.id);
  return course;
};

export const updateYogaCourseDetailsService = async (
  courseId,
  {
    title,
    slug,
    description,
    price,
    discount,
    totalPayableAmount,
    roundPayableAmount,
    prelaunch,
    sequentialUnlock,
    thumbnailUrl,
    thumbnailId,
    status,
  },
) => {
  const existingCourse = await prisma.yogaCourse.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      slug: true,
      prelaunchEnabled: true,
      prelaunchStartAt: true,
      prelaunchEndAt: true,
      prelaunchDiscount: true,
    },
  });

  if (!existingCourse) {
    const error = new Error(ERROR_MESSAGES.COURSE_NOT_FOUND);
    error.statusCode = 404;
    throw error;
  }

  const courseSlug = slug && slug !== existingCourse.slug ? await ensureAvailableCourseSlug(slug, courseId) : undefined;
  const prelaunchData = buildPrelaunchData({ prelaunch, price, roundPayableAmount, existingCourse });

  const course = await prisma.yogaCourse.update({
    where: {
      id: courseId,
    },
    data: {
      title,
      slug: courseSlug,
      description,
      status,
      price,
      discount,
      totalPayableAmount,
      ...(prelaunchData ?? {}),
      sequentialUnlock,
      thumbnailUrl,
      thumbnailId,
    },
  });

  revalidateCoursePages(courseId);
  return course;
};

const formatPrelaunchForAdmin = (course) => ({
  prelaunchEnabled: course.prelaunchEnabled,
  prelaunchStartDate: utcToIstDate(course.prelaunchStartAt),
  prelaunchEndDate: utcToIstDate(course.prelaunchEndAt),
  prelaunchDiscount: course.prelaunchDiscount,
  prelaunchPayableAmount: course.prelaunchPayableAmount,
  prelaunchState: getPrelaunchState(course),
});

const adminCoursePrelaunchSelect = {
  prelaunchEnabled: true,
  prelaunchStartAt: true,
  prelaunchEndAt: true,
  prelaunchDiscount: true,
  prelaunchPayableAmount: true,
};

export const getYogaCourseDetailsService = async (courseId) => {
  const course = await prisma.yogaCourse.findUnique({
    where: {
      id: courseId,
    },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      status: true,
      price: true,
      discount: true,
      totalPayableAmount: true,
      ...adminCoursePrelaunchSelect,
      sequentialUnlock: true,
      landingPageEnabled: true,
      thumbnailUrl: true,
      thumbnailId: true,
      createdAt: true,
      updatedAt: true,
      courseVideos: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          originalFileName: true,
          title: true,
          description: true,
          thumbnailUrl: true,
          status: true,
          durationSeconds: true,
          fileSize: true,
          sortOrder: true,
          releaseAt: true,
          groupId: true,
        },
      },
      videoGroups: videoGroupSelect,
    },
  });

  if (!course) {
    const error = new Error(ERROR_MESSAGES.COURSE_NOT_FOUND);
    error.statusCode = 404;
    throw error;
  }

  const { prelaunchStartAt, prelaunchEndAt, videoGroups, ...courseData } = course;
  const now = new Date();
  const courseVideos = course.courseVideos.map((video) => ({
    id: video.id,
    originalName: video.originalFileName,
    title: video.title,
    description: video.description,
    thumbnailUrl: video.thumbnailUrl,
    status: video.status,
    durationSeconds: video.durationSeconds,
    fileSize: video.fileSize.toString(),
    sortOrder: video.sortOrder,
    releaseDate: utcToIstDate(video.releaseAt),
    isScheduled: Boolean(video.releaseAt && video.releaseAt > now),
    groupId: video.groupId,
  }));

  return {
    ...courseData,
    ...formatPrelaunchForAdmin(course),
    courseVideos,
    groups: groupCourseVideos(courseVideos, videoGroups, { includeEmpty: true }),
  };
};

export const getYogaCourseStepOneService = async (courseId) => {
  const course = await prisma.yogaCourse.findUnique({
    where: {
      id: courseId,
    },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      status: true,
      price: true,
      discount: true,
      totalPayableAmount: true,
      ...adminCoursePrelaunchSelect,
      sequentialUnlock: true,
      thumbnailUrl: true,
      thumbnailId: true,
    },
  });

  if (!course) {
    const error = new Error(ERROR_MESSAGES.COURSE_NOT_FOUND);
    error.statusCode = 404;
    throw error;
  }

  return {
    courseId: course.id,
    title: course.title,
    slug: course.slug,
    ...formatPrelaunchForAdmin(course),
    sequentialUnlock: course.sequentialUnlock,
    description: course.description,
    status: course.status,
    price: Number(course.price),
    discountPercentage: course.discount,
    totalPayableAmount: Number(course.totalPayableAmount),
    thumbnailURL: course.thumbnailUrl,
    thumbnailId: course.thumbnailId,
  };
};

export const publishYogaCourseService = async (courseId) => {
  const result = await prisma.$transaction(async (transaction) => {
    const course = await transaction.yogaCourse.findUnique({
      where: {
        id: courseId,
      },
      select: {
        id: true,
        title: true,
        status: true,
        courseVideos: {
          select: {
            status: true,
            readyToStream: true,
          },
        },
      },
    });

    if (!course) {
      return {
        success: false,
        statusCode: 404,
        message: ERROR_MESSAGES.COURSE_NOT_FOUND,
      };
    }

    if (course.courseVideos.length === 0) {
      return {
        success: false,
        statusCode: 400,
        message: ERROR_MESSAGES.COURSE_HAS_NO_VIDEOS,
      };
    }

    const allVideosReady = course.courseVideos.every(
      (video) => video.status === "READY" && video.readyToStream === true,
    );

    if (!allVideosReady) {
      return {
        success: false,
        statusCode: 400,
        message: ERROR_MESSAGES.COURSE_VIDEOS_NOT_READY,
      };
    }

    const publishedCourse = await transaction.yogaCourse.update({
      where: {
        id: courseId,
      },
      data: {
        status: "PUBLISHED",
      },
      select: {
        id: true,
        title: true,
        status: true,
      },
    });

    return {
      success: true,
      course: publishedCourse,
    };
  });

  if (result.success) revalidateCoursePages(courseId);
  return result;
};

export const fetchAllYogaCoursesService = async () => {
  const courses = await prisma.yogaCourse.findMany({
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      price: true,
      discount: true,
      totalPayableAmount: true,
      slug: true,
      ...adminCoursePrelaunchSelect,
      sequentialUnlock: true,
      landingPageEnabled: true,
      thumbnailUrl: true,
      thumbnailId: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          courseVideos: true,
          enrollments: {
            where: {
              status: "ACTIVE",
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            },
          },
        },
      },
      reviews: {
        select: {
          rating: true,
        },
      },
    },
  });

  return courses.map(({ _count, reviews, prelaunchStartAt, prelaunchEndAt, ...course }) => ({
    ...course,
    ...formatPrelaunchForAdmin({ ...course, prelaunchStartAt, prelaunchEndAt }),
    videoCount: _count.courseVideos,
    totalEnrolledStudents: _count.enrollments,
    averageRating:
      reviews.length > 0
        ? Number((reviews.reduce((total, review) => total + Number(review.rating), 0) / reviews.length).toFixed(2))
        : 0,
  }));
};

const averageRating = (ratings) =>
  ratings.length > 0
    ? Number((ratings.reduce((total, item) => total + Number(item.rating), 0) / ratings.length).toFixed(2))
    : 0;

export const getYogaCourseAnalyticsService = async (courseId) => {
  const course = await prisma.yogaCourse.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      price: true,
      discount: true,
      totalPayableAmount: true,
      thumbnailUrl: true,
      thumbnailId: true,
      createdAt: true,
      updatedAt: true,
      enrollments: {
        orderBy: { enrolledAt: "desc" },
        select: {
          id: true,
          status: true,
          enrolledAt: true,
          expiresAt: true,
          revokedAt: true,
          revokeReason: true,
          user: { select: { id: true, name: true, email: true, status: true } },
        },
      },
      reviews: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          updatedAt: true,
          user: { select: { id: true, name: true, email: true, status: true } },
        },
      },
      courseVideos: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          description: true,
          originalFileName: true,
          fileType: true,
          fileSize: true,
          status: true,
          readyToStream: true,
          processingPercentage: true,
          durationSeconds: true,
          thumbnailUrl: true,
          thumbnailId: true,
          sortOrder: true,
          createdAt: true,
          updatedAt: true,
          ratings: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              rating: true,
              createdAt: true,
              updatedAt: true,
              user: { select: { id: true, name: true, email: true, status: true } },
            },
          },
        },
      },
    },
  });

  if (!course) {
    const error = new Error(ERROR_MESSAGES.COURSE_NOT_FOUND);
    error.statusCode = 404;
    throw error;
  }

  const { enrollments, reviews, courseVideos, ...courseInfo } = course;
  const activeEnrollments = enrollments.filter(
    (enrollment) =>
      enrollment.status === "ACTIVE" && (!enrollment.expiresAt || enrollment.expiresAt > new Date()),
  );

  return {
    course: {
      ...courseInfo,
      price: Number(courseInfo.price),
      totalPayableAmount: Number(courseInfo.totalPayableAmount),
    },
    analytics: {
      totalEnrollments: enrollments.length,
      activeEnrollments: activeEnrollments.length,
      totalCourseReviews: reviews.length,
      averageCourseRating: averageRating(reviews),
      totalVideoRatings: courseVideos.reduce((total, video) => total + video.ratings.length, 0),
    },
    enrolledUsers: enrollments,
    courseReviews: reviews,
    videos: courseVideos.map(({ ratings, fileSize, ...video }) => ({
      ...video,
      fileSize: fileSize.toString(),
      totalRatings: ratings.length,
      averageRating: averageRating(ratings),
      ratings,
    })),
  };
};

export const revokeCourseAccessService = async ({ courseId, userId, reason }) => {
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: {
      id: true,
      status: true,
      user: { select: { name: true, email: true } },
      course: { select: { title: true } },
    },
  });

  if (!enrollment) {
    const error = new Error("No enrollment found for this user and course");
    error.statusCode = 404;
    throw error;
  }

  if (enrollment.status !== "ACTIVE") {
    const error = new Error("Course access is already revoked or inactive");
    error.statusCode = 409;
    throw error;
  }

  const revokedEnrollment = await prisma.enrollment.update({
    where: { id: enrollment.id },
    data: { status: "REVOKED", revokedAt: new Date(), revokeReason: reason },
    select: { id: true, status: true, revokedAt: true, revokeReason: true },
  });

  await SendEmailNotificationService(enrollment.user.email, "EMAIL_COURSE_ACCESS_REVOKED", {
    name: enrollment.user.name,
    courseTitle: enrollment.course.title,
    reason,
  });

  return revokedEnrollment;
};

export const restoreCourseAccessService = async ({ courseId, userId }) => {
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: {
      id: true,
      status: true,
      user: { select: { name: true, email: true } },
      course: { select: { title: true } },
    },
  });

  if (!enrollment) {
    const error = new Error("No enrollment found for this user and course");
    error.statusCode = 404;
    throw error;
  }

  if (enrollment.status !== "REVOKED") {
    const error = new Error("Course access is not revoked");
    error.statusCode = 409;
    throw error;
  }

  const restoredEnrollment = await prisma.enrollment.update({
    where: { id: enrollment.id },
    data: { status: "ACTIVE", revokedAt: null, revokeReason: null },
    select: { id: true, status: true, revokedAt: true },
  });

  await SendEmailNotificationService(enrollment.user.email, "EMAIL_COURSE_ACCESS_RESTORED", {
    name: enrollment.user.name,
    courseTitle: enrollment.course.title,
  });

  return restoredEnrollment;
};

export const deleteYogaCourseService = async (courseId) => {
  const course = await prisma.yogaCourse.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      thumbnailId: true,
      landingContent: { select: { content: true, trailerVideoUid: true, trailerPosterId: true } },
      courseVideos: {
        select: {
          cloudflareVideoUid: true,
          thumbnailId: true,
        },
      },
      _count: {
        select: {
          orders: true,
          enrollments: true,
        },
      },
    },
  });

  if (!course) {
    const error = new Error(ERROR_MESSAGES.COURSE_NOT_FOUND);
    error.statusCode = 404;
    throw error;
  }

  if (course._count.orders > 0 || course._count.enrollments > 0) {
    const error = new Error("Course cannot be deleted because it has enrolled students");
    error.statusCode = 409;
    throw error;
  }

  const imageIds = [
    course.thumbnailId,
    ...getLandingContentImageIds(course.landingContent?.content),
    course.landingContent?.trailerPosterId,
    ...course.courseVideos.map((video) => video.thumbnailId),
  ].filter(
    isValidCloudflareImageId,
  );
  const uniqueImageIds = [...new Set(imageIds)];

  await Promise.all([
    ...course.courseVideos
      .map((video) => video.cloudflareVideoUid)
      .filter(Boolean)
      .map((videoUid) => deleteYogaCourseVideoFromCloudFlair(videoUid)),
    ...uniqueImageIds.map((imageId) => deleteCloudflareImageIfPresent(imageId)),
    course.landingContent?.trailerVideoUid
      ? deleteYogaCourseVideoFromCloudFlair(course.landingContent.trailerVideoUid).catch((error) =>
          console.error("Trailer deletion on Cloudflare failed:", error.message),
        )
      : null,
  ]);

  await prisma.yogaCourse.delete({ where: { id: courseId } });
  revalidateCoursePages(courseId);

  return {
    courseId,
    deletedVideoCount: course.courseVideos.length,
    deletedThumbnailCount: uniqueImageIds.length,
    deleted: true,
  };
};

// ---------- Course landing page: content, trailer (feature: optional public landing page) ----------

const notFoundCourse = () => {
  const error = new Error(ERROR_MESSAGES.COURSE_NOT_FOUND);
  error.statusCode = 404;
  return error;
};

const formatTrailer = (landingContent) => {
  if (!landingContent?.trailerVideoUid) return null;

  return {
    videoUid: landingContent.trailerVideoUid,
    status: landingContent.trailerStatus,
    fileName: landingContent.trailerFileName,
    durationSeconds: landingContent.trailerDurationSeconds,
    thumbnailUrl: landingContent.trailerThumbnailUrl,
    posterUrl: landingContent.trailerPosterUrl,
    posterId: landingContent.trailerPosterId,
  };
};

const formatLandingPageForAdmin = (course) => ({
  courseId: course.id,
  title: course.title,
  slug: course.slug,
  status: course.status,
  landingPageEnabled: course.landingPageEnabled,
  content: formatLandingContent(course.landingContent?.content),
  trailer: formatTrailer(course.landingContent),
});

const landingPageAdminSelect = {
  id: true,
  title: true,
  slug: true,
  status: true,
  landingPageEnabled: true,
  landingContent: true,
};

/**
 * While a trailer is still uploading/processing, ask Cloudflare for its status. The webhook normally
 * does this, but webhooks can't reach a local development server.
 */
const syncTrailerStatusFromCloudflare = async (courseId, landingContent) => {
  const isPending = landingContent?.trailerVideoUid && !["READY", "ERROR"].includes(landingContent.trailerStatus);
  if (!isPending || !EnvConfig.CLOUDFLARE_ACCOUNT_ID || !EnvConfig.CLOUDFLARE_STREAM_API_TOKEN) return landingContent;

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${EnvConfig.CLOUDFLARE_ACCOUNT_ID}/stream/${encodeURIComponent(landingContent.trailerVideoUid)}`,
      { headers: { Authorization: `Bearer ${EnvConfig.CLOUDFLARE_STREAM_API_TOKEN}` }, signal: AbortSignal.timeout(8000) },
    );
    const result = (await response.json())?.result;
    if (!response.ok || !result) return landingContent;

    const state = result.status?.state;
    const data =
      result.readyToStream === true && state === "ready"
        ? {
            trailerStatus: "READY",
            trailerHlsUrl: result.playback?.hls ?? null,
            trailerThumbnailUrl: result.thumbnail ?? null,
            trailerDurationSeconds: result.duration ?? null,
          }
        : state === "error"
          ? { trailerStatus: "ERROR" }
          : ["queued", "inprogress", "downloading"].includes(state)
            ? { trailerStatus: "PROCESSING" }
            : null;
    if (!data || data.trailerStatus === landingContent.trailerStatus) return landingContent;

    const updated = await prisma.courseLandingContent.update({ where: { courseId }, data });
    if (data.trailerStatus === "READY") revalidateCoursePages(courseId);
    return updated;
  } catch (error) {
    console.error("Trailer status check failed:", error.message);
    return landingContent;
  }
};

export const getCourseLandingContentService = async (courseId) => {
  const course = await prisma.yogaCourse.findUnique({ where: { id: courseId }, select: landingPageAdminSelect });
  if (!course) throw notFoundCourse();
  const landingContent = await syncTrailerStatusFromCloudflare(courseId, course.landingContent);
  return formatLandingPageForAdmin({ ...course, landingContent });
};

export const updateCourseLandingContentService = async (courseId, input) => {
  const course = await prisma.yogaCourse.findUnique({
    where: { id: courseId },
    select: { id: true, landingContent: { select: { content: true, trailerPosterId: true } } },
  });
  if (!course) throw notFoundCourse();

  const landingPageEnabled = input.landingPageEnabled === true;
  const content = sanitizeLandingContentInput(input.content ?? {});
  const trailerPosterUrl = typeof input.trailerPosterUrl === "string" ? input.trailerPosterUrl.trim().slice(0, 1000) : undefined;
  const trailerPosterId = trailerPosterUrl ? String(input.trailerPosterId ?? "").trim().slice(0, 255) || null : null;
  const posterData = trailerPosterUrl === undefined ? {} : { trailerPosterUrl: trailerPosterUrl || null, trailerPosterId };

  const [updatedCourse] = await prisma.$transaction([
    prisma.yogaCourse.update({ where: { id: courseId }, data: { landingPageEnabled }, select: { id: true } }),
    prisma.courseLandingContent.upsert({
      where: { courseId },
      update: { content, ...posterData },
      create: { courseId, content, ...posterData },
    }),
  ]);

  // Images that were replaced or removed are no longer used anywhere, so delete them (best effort).
  const previousImageIds = [
    ...getLandingContentImageIds(course.landingContent?.content),
    course.landingContent?.trailerPosterId,
  ].filter(Boolean);
  const currentImageIds = new Set([...getLandingContentImageIds(content), posterData.trailerPosterId ?? course.landingContent?.trailerPosterId]);
  previousImageIds
    .filter((imageId) => !currentImageIds.has(imageId))
    .forEach((imageId) => deleteCloudflareImageIfPresent(imageId).catch((error) => console.error("Image clean-up failed:", error.message)));

  revalidateCoursePages(updatedCourse.id);
  return getCourseLandingContentService(courseId);
};

/**
 * Creates a direct (TUS) upload for the course trailer on Cloudflare Stream. Unlike lesson videos the
 * trailer is public (no signed URLs), so anyone can watch it on the landing page. Uploading a new
 * trailer replaces the old one.
 */
export const createCourseTrailerUploadService = async ({ courseId, fileName, fileType, fileSize, maxDurationSeconds }) => {
  const course = await prisma.yogaCourse.findUnique({
    where: { id: courseId },
    select: { id: true, landingContent: { select: { trailerVideoUid: true } } },
  });
  if (!course) throw notFoundCourse();

  if (!EnvConfig.CLOUDFLARE_ACCOUNT_ID || !EnvConfig.CLOUDFLARE_STREAM_API_TOKEN) {
    throw new Error(ERROR_MESSAGES.CLOUDFLARE_STREAM_CONFIGURATION_MISSING);
  }

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const uploadMetadata = encodeMetadata({
    name: fileName,
    maxDurationSeconds: String(Math.ceil(maxDurationSeconds)),
    expiry: expiresAt,
  });

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${EnvConfig.CLOUDFLARE_ACCOUNT_ID}/stream?direct_user=true`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${EnvConfig.CLOUDFLARE_STREAM_API_TOKEN}`,
        "Tus-Resumable": "1.0.0",
        "Upload-Length": String(fileSize),
        "Upload-Metadata": uploadMetadata,
      },
    },
  );

  const uploadUrl = response.headers.get("Location");
  const videoUid = response.headers.get("stream-media-id");
  if (!response.ok || !uploadUrl || !videoUid) {
    console.error("Cloudflare trailer upload initialization failed:", response.status, await response.text().catch(() => ""));
    throw new Error(ERROR_MESSAGES.VIDEO_UPLOAD_INITIALIZATION_FAILED);
  }

  const previousVideoUid = course.landingContent?.trailerVideoUid;
  const trailerData = {
    trailerVideoUid: videoUid,
    trailerStatus: "UPLOADING",
    trailerHlsUrl: null,
    trailerThumbnailUrl: null,
    trailerDurationSeconds: null,
    trailerFileName: fileName,
  };

  await prisma.courseLandingContent.upsert({
    where: { courseId },
    update: trailerData,
    create: { courseId, ...trailerData },
  });

  if (previousVideoUid && previousVideoUid !== videoUid) {
    deleteYogaCourseVideoFromCloudFlair(previousVideoUid).catch((error) =>
      console.error("Old trailer clean-up failed:", error.message),
    );
  }

  revalidateCoursePages(courseId);
  return { videoUid, uploadUrl, expiresAt };
};

export const deleteCourseTrailerService = async (courseId) => {
  const landingContent = await prisma.courseLandingContent.findUnique({
    where: { courseId },
    select: { trailerVideoUid: true, trailerPosterId: true },
  });
  if (!landingContent?.trailerVideoUid) {
    const error = new Error("This course has no trailer");
    error.statusCode = 404;
    throw error;
  }

  await prisma.courseLandingContent.update({
    where: { courseId },
    data: {
      trailerVideoUid: null,
      trailerStatus: null,
      trailerHlsUrl: null,
      trailerThumbnailUrl: null,
      trailerDurationSeconds: null,
      trailerFileName: null,
      trailerPosterUrl: null,
      trailerPosterId: null,
    },
  });

  await Promise.all([
    deleteYogaCourseVideoFromCloudFlair(landingContent.trailerVideoUid).catch((error) =>
      console.error("Trailer deletion on Cloudflare failed:", error.message),
    ),
    landingContent.trailerPosterId ? deleteCloudflareImageIfPresent(landingContent.trailerPosterId).catch(() => null) : null,
  ]);

  revalidateCoursePages(courseId);
  return { courseId, deleted: true };
};
