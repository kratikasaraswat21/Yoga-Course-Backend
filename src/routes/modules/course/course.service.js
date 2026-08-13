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
    },
  });

  return courses.map(({ _count, price, totalPayableAmount, ...course }) => ({
    ...course,
    price: Number(price),
    totalPayableAmount: Number(totalPayableAmount),
    videoCount: _count.courseVideos,
  }));
};

const ensureEnrollment = async (userId, courseId) => {
  const enrollment = await prisma.enrollment.findFirst({ where: activeEnrollmentWhere(userId, courseId) });
  if (!enrollment) {
    const error = new Error("You must purchase this course first");
    error.statusCode = 403;
    throw error;
  }
};

export const getPublishedCoursesService = async () => {
  const courses = await prisma.yogaCourse.findMany({
    where: {
      status: CourseStatus.PUBLISHED,
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
        },
      },
    },
  });

  if (!course) {
    const error = new Error(ERROR_MESSAGES.COURSE_NOT_FOUND);
    error.statusCode = 404;
    throw error;
  }

  return course;
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
        where: activeEnrollmentWhere(userId, courseId),
        select: { id: true },
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
        },
      },
    },
  });

  if (!course) {
    const error = new Error(ERROR_MESSAGES.COURSE_NOT_FOUND);
    error.statusCode = 404;
    throw error;
  }

  const { enrollments, ...courseData } = course;

  return {
    ...courseData,
    price: Number(course.price),
    totalPayableAmount: Number(course.totalPayableAmount),
    videoCount: course.courseVideos.length,
    isPurchased: enrollments.length > 0,
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
