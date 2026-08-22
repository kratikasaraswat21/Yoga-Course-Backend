import { EnvConfig } from "#src/config/env.config.js";
import { CourseStatus } from "#src/lib/enum.js";
import { prisma } from "#src/lib/prisma.js";
import { ERROR_MESSAGES } from "#src/utils/error.messages.js";

const activeEnrollmentWhere = (userId, courseId) => ({
  userId,
  ...(courseId ? { courseId } : {}),
  status: "ACTIVE",
  OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
});

export const getPurchasedCoursesService = async (userId) => {
  const courses = await prisma.yogaCourse.findMany({
    where: {
      status: CourseStatus.PUBLISHED,
      enrollments: { some: activeEnrollmentWhere(userId, undefined) },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, title: true, description: true, price: true, discount: true,
      totalPayableAmount: true, thumbnailUrl: true, createdAt: true,
      _count: { select: { courseVideos: true } },
      courseVideos: {
        select: {
          completions: {
            where: { userId },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  });

  return courses.map(({ _count, courseVideos, price, totalPayableAmount, ...course }) => ({
    ...course,
    price: Number(price),
    totalPayableAmount: Number(totalPayableAmount),
    videoCount: _count.courseVideos,
    completedVideoCount: courseVideos.filter((video) => video.completions.length > 0).length,
  }));
};

const ensureEnrollment = async (userId, courseId) => {
  const enrollment = await prisma.enrollment.findFirst({
    where: { userId, courseId },
    select: { status: true, expiresAt: true },
  });
  const hasActiveEnrollment =
    enrollment?.status === "ACTIVE" && (!enrollment.expiresAt || enrollment.expiresAt > new Date());

  if (!hasActiveEnrollment) {
    const error = new Error(
      enrollment?.status === "REVOKED"
        ? "Your access to this course has been revoked"
        : "You have not purchased this course",
    );
    error.statusCode = 400;
    throw error;
  }
};

export const getPublishedCoursesService = async (userId) => {
  const courses = await prisma.yogaCourse.findMany({
    where: {
      status: CourseStatus.PUBLISHED,
      ...(userId
        ? {
            enrollments: {
              none: activeEnrollmentWhere(userId, undefined),
            },
          }
        : {}),
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      title: true,
      description: true,
      price: true,
      discount: true,
      totalPayableAmount: true,
      thumbnailUrl: true,
      createdAt: true,
      _count: {
        select: {
          courseVideos: true,
        },
      },
    },
  });

  return courses.map(({ _count, price, totalPayableAmount, ...course }) => ({
    ...course,
    price: Number(price),
    totalPayableAmount: Number(totalPayableAmount),
    videoCount: _count.courseVideos,
  }));
};

const getLandingPageCourses = async () => {
  const courses = await prisma.yogaCourse.findMany({
    where: { status: CourseStatus.PUBLISHED },
    select: {
      id: true,
      title: true,
      description: true,
      price: true,
      discount: true,
      totalPayableAmount: true,
      thumbnailUrl: true,
      createdAt: true,
      courseVideos: {
        select: { durationSeconds: true },
      },
      reviews: {
        select: { rating: true },
      },
      enrollments: {
        where: {
          status: "ACTIVE",
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: { id: true },
      },
    },
  });

  return courses
    .map(({ courseVideos, reviews, enrollments, createdAt, price, totalPayableAmount, ...course }) => {
      const totalDurationSeconds = courseVideos.reduce(
        (total, video) => total + (Number(video.durationSeconds) || 0),
        0,
      );
      const rating = reviews.length
        ? Number((reviews.reduce((total, review) => total + Number(review.rating), 0) / reviews.length).toFixed(2))
        : 0;

      return {
        courseId: course.id,
        title: course.title,
        description: course.description,
        rating,
        price: Number(price),
        discount: course.discount,
        totalPayableAmount: Number(totalPayableAmount),
        totalVideos: courseVideos.length,
        totalHours: Number((totalDurationSeconds / 3600).toFixed(2)),
        totalStudents: enrollments.length,
        thumbnail: course.thumbnailUrl,
        createdAt,
      };
    })
    .sort((firstCourse, secondCourse) => secondCourse.rating - firstCourse.rating || secondCourse.createdAt - firstCourse.createdAt)
    .map(({ createdAt, ...course }) => course);
};

export const getTopRatedLandingCoursesService = async () => {
  const courses = await getLandingPageCourses();
  return courses.slice(0, 3);
};

export const getAllLandingCoursesService = async () => getLandingPageCourses();

export const getPublishedCourseVideosService = async (courseId, userId) => {
  if (userId) await ensureEnrollment(userId, courseId);
  const course = await prisma.yogaCourse.findFirst({
    where: {
      id: courseId,
      status: CourseStatus.PUBLISHED,
    },
    select: {
      id: true,
      title: true,
      courseVideos: {
        where: {
          status: "READY",
          readyToStream: true,
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          description: true,
          thumbnailUrl: true,
          durationSeconds: true,
          sortOrder: true,
          completions: {
            where: { userId },
            select: { id: true },
            take: 1,
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

  return {
    ...course,
    courseVideos: course.courseVideos.map(({ completions, ...video }) => ({
      ...video,
      isCompleted: completions.length > 0,
    })),
  };
};

export const getPublishedCourseDetailsService = async (courseId, userId) => {
  const course = await prisma.yogaCourse.findFirst({
    where: {
      id: courseId,
      status: CourseStatus.PUBLISHED,
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
      createdAt: true,
      updatedAt: true,
      enrollments: {
        where: { userId },
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { id: true, status: true, expiresAt: true },
      },
      reviews: {
        where: { userId },
        select: { id: true },
        take: 1,
      },
      courseVideos: {
        where: {
          status: "READY",
          readyToStream: true,
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          description: true,
          thumbnailUrl: true,
          durationSeconds: true,
          sortOrder: true,
          completions: {
            where: { userId },
            select: { id: true },
            take: 1,
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

  const { enrollments, reviews, ...courseData } = course;
  const enrollment = enrollments[0];
  const hasActiveEnrollment =
    enrollment?.status === "ACTIVE" && (!enrollment.expiresAt || enrollment.expiresAt > new Date());
  const videosWithCompletion = course.courseVideos.map(({ completions, ...video }) => ({
    ...video,
    isCompleted: completions.length > 0,
  }));

  return {
    ...courseData,
    price: Number(course.price),
    totalPayableAmount: Number(course.totalPayableAmount),
    courseVideos: videosWithCompletion,
    videoCount: videosWithCompletion.length,
    isPurchased: hasActiveEnrollment,
    isBought: hasActiveEnrollment,
    isAccessRevoked: enrollment?.status === "REVOKED",
    hasReviewed: reviews.length > 0,
    isCourseCompleted:
      videosWithCompletion.length > 0 && videosWithCompletion.every((video) => video.isCompleted),
  };
};

export const getCourseVideoPlaybackService = async ({ courseId, videoId, userId }) => {
  await ensureEnrollment(userId, courseId);
  const video = await prisma.courseVideo.findFirst({
    where: {
      id: videoId,
      yogaCourseId: courseId,
      status: "READY",
      readyToStream: true,
      yogaCourse: {
        status: CourseStatus.PUBLISHED,
      },
    },
    select: {
      id: true,
      title: true,
      durationSeconds: true,
      cloudflareVideoUid: true,
      hlsUrl: true,
      dashUrl: true,
      thumbnailUrl: true,
      yogaCourse: {
        select: {
          reviews: {
            where: { userId },
            select: { id: true },
            take: 1,
          },
        },
      },
      completions: {
        where: { userId },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!video) {
    const error = new Error(ERROR_MESSAGES.VIDEO_NOT_FOUND);
    error.statusCode = 404;
    throw error;
  }

  if (!video.cloudflareVideoUid || !video.hlsUrl) {
    const error = new Error(ERROR_MESSAGES.VIDEO_NOT_READY);
    error.statusCode = 409;
    throw error;
  }

  if (!EnvConfig.CLOUDFLARE_ACCOUNT_ID || !EnvConfig.CLOUDFLARE_STREAM_API_TOKEN) {
    const error = new Error(ERROR_MESSAGES.CLOUDFLARE_STREAM_CONFIGURATION_MISSING);
    error.statusCode = 500;
    throw error;
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${EnvConfig.CLOUDFLARE_ACCOUNT_ID}/stream/${encodeURIComponent(video.cloudflareVideoUid)}/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${EnvConfig.CLOUDFLARE_STREAM_API_TOKEN}`,
      },
    },
  );

  const responseData = await response.json();
  const playbackToken = responseData.result?.token;

  if (!response.ok || !responseData.success || !playbackToken) {
    const error = new Error(ERROR_MESSAGES.VIDEO_PLAYBACK_TOKEN_FAILED);
    error.statusCode = response.status >= 400 ? response.status : 502;
    throw error;
  }

  const replaceVideoUidWithToken = (playbackUrl) =>
    playbackUrl?.replace(video.cloudflareVideoUid, playbackToken) ?? null;

  return {
    videoId: video.id,
    title: video.title,
    durationSeconds: video.durationSeconds,
    playbackToken,
    expiresInSeconds: 60 * 60,
    hlsUrl: replaceVideoUidWithToken(video.hlsUrl),
    dashUrl: replaceVideoUidWithToken(video.dashUrl),
    thumbnailUrl: video.thumbnailUrl,
    isCompleted: video.completions.length > 0,
    hasReviewed: video.yogaCourse.reviews.length > 0,
  };
};

export const getOtherCourseVideosService = async ({ courseId, videoId, userId }) => {
  if (userId) await ensureEnrollment(userId, courseId);
  const course = await prisma.yogaCourse.findFirst({
    where: {
      id: courseId,
      status: CourseStatus.PUBLISHED,
    },
    select: {
      id: true,
      title: true,
      courseVideos: {
        where: {
          status: "READY",
          readyToStream: true,
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          description: true,
          thumbnailUrl: true,
          durationSeconds: true,
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
    videoCount: course.courseVideos.length,
  };
};
