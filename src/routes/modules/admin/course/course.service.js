import { EnvConfig } from "#src/config/env.config.js";
import { CourseStatus } from "#src/lib/enum.js";
import { prisma } from "#src/lib/prisma.js";
import { ERROR_MESSAGES } from "#src/utils/error.messages.js";
import { deleteYogaCourseVideoFromCloudFlair } from "#src/routes/modules/admin/video-uploads/video-upload.service.js";
import { SendEmailNotificationService } from "#src/email/email.service.js";

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

export const addYogaCourseForStepOne = async ({
  title,
  description,
  price,
  discount,
  totalPayableAmount,
  thumbnailUrl,
  thumbnailId,
}) => {
  return await prisma.yogaCourse.create({
    data: {
      title,
      description,
      status: CourseStatus.DRAFT,
      price,
      discount,
      totalPayableAmount,
      thumbnailUrl,
      thumbnailId,
    },
  });
};

export const updateYogaCourseDetailsService = async (
  courseId,
  { title, description, price, discount, totalPayableAmount, thumbnailUrl, thumbnailId, status },
) => {
  return await prisma.yogaCourse.update({
    where: {
      id: courseId,
    },
    data: {
      title,
      description,
      status,
      price,
      discount,
      totalPayableAmount,
      thumbnailUrl,
      thumbnailId,
    },
  });
};

export const getYogaCourseDetailsService = async (courseId) => {
  const course = await prisma.yogaCourse.findUnique({
    where: {
      id: courseId,
    },
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
        },
      },
    },
  });

  if (!course) {
    const error = new Error(ERROR_MESSAGES.COURSE_NOT_FOUND);
    error.statusCode = 404;
    throw error;
  }

  return {
    ...course,
    courseVideos: course.courseVideos.map((video) => ({
      id: video.id,
      originalName: video.originalFileName,
      title: video.title,
      description: video.description,
      thumbnailUrl: video.thumbnailUrl,
      status: video.status,
      durationSeconds: video.durationSeconds,
      fileSize: video.fileSize.toString(),
      sortOrder: video.sortOrder,
    })),
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
      description: true,
      status: true,
      price: true,
      discount: true,
      totalPayableAmount: true,
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
  return prisma.$transaction(async (transaction) => {
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

  return courses.map(({ _count, reviews, ...course }) => ({
    ...course,
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

  const imageIds = [course.thumbnailId, ...course.courseVideos.map((video) => video.thumbnailId)].filter(
    isValidCloudflareImageId,
  );
  const uniqueImageIds = [...new Set(imageIds)];

  await Promise.all([
    ...course.courseVideos
      .map((video) => video.cloudflareVideoUid)
      .filter(Boolean)
      .map((videoUid) => deleteYogaCourseVideoFromCloudFlair(videoUid)),
    ...uniqueImageIds.map((imageId) => deleteCloudflareImageIfPresent(imageId)),
  ]);

  await prisma.yogaCourse.delete({ where: { id: courseId } });

  return {
    courseId,
    deletedVideoCount: course.courseVideos.length,
    deletedThumbnailCount: uniqueImageIds.length,
    deleted: true,
  };
};
