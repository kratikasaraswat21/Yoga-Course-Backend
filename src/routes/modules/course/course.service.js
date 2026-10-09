import { EnvConfig } from "#src/config/env.config.js";
import { CourseStatus } from "#src/lib/enum.js";
import { prisma } from "#src/lib/prisma.js";
import { ERROR_MESSAGES } from "#src/utils/error.messages.js";
import { coursePricingSelect, getCoursePricing, withCurrentPricing } from "#src/utils/course-pricing.util.js";
import { formatLandingContent } from "#src/utils/course-landing.util.js";
import { utcToIstDate } from "#src/utils/ist-date.util.js";
import { groupCourseVideos, videoGroupSelect } from "#src/utils/course-video-group.util.js";
import { applySequentialLock, ensureVideoUnlockedInOrder } from "#src/utils/sequential-lock.util.js";
import {
  applyVideoVisibility,
  createVideoLockedError,
  isVideoReleased,
  releasedVideoWhere,
} from "#src/utils/video-visibility.util.js";

const readyVideoWhere = { status: "READY", readyToStream: true };

const getEarliestUpcomingRelease = (videos, now = new Date()) => {
  const upcoming = videos
    .filter((video) => video.releaseAt && new Date(video.releaseAt) > now)
    .map((video) => new Date(video.releaseAt))
    .sort((first, second) => first - second)[0];

  return upcoming ? { upcomingReleaseAt: upcoming.toISOString(), upcomingReleaseDate: utcToIstDate(upcoming) } : { upcomingReleaseAt: null, upcomingReleaseDate: null };
};

const activeEnrollmentWhere = (userId, courseId) => ({
  userId,
  ...(courseId ? { courseId } : {}),
  status: "ACTIVE",
  OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
});

export const getPurchasedCoursesService = async (userId) => {
  const now = new Date();
  const courses = await prisma.yogaCourse.findMany({
    where: {
      status: CourseStatus.PUBLISHED,
      enrollments: { some: activeEnrollmentWhere(userId, undefined) },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, title: true, description: true, price: true, discount: true,
      totalPayableAmount: true, thumbnailUrl: true, createdAt: true, slug: true,
      courseVideos: {
        where: { ...readyVideoWhere, ...releasedVideoWhere(now) },
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

  return courses.map(({ courseVideos, price, totalPayableAmount, ...course }) => ({
    ...course,
    price: Number(price),
    totalPayableAmount: Number(totalPayableAmount),
    videoCount: courseVideos.length,
    completedVideoCount: courseVideos.filter((video) => video.completions.length > 0).length,
  }));
};

const ensureEnrollment = async (userId, courseId) => {
  const enrollment = await prisma.enrollment.findFirst({
    where: { userId, courseId },
    select: { status: true, expiresAt: true, isPrelaunchPurchase: true },
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

  return enrollment;
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
      slug: true,
      landingPageEnabled: true,
      description: true,
      ...coursePricingSelect,
      thumbnailUrl: true,
      createdAt: true,
      _count: {
        select: {
          courseVideos: true,
        },
      },
    },
  });

  const now = new Date();
  return courses.map(({ _count, ...course }) => ({
    ...withCurrentPricing(course, now),
    videoCount: _count.courseVideos,
  }));
};

const getLandingPageCourses = async () => {
  const courses = await prisma.yogaCourse.findMany({
    where: { status: CourseStatus.PUBLISHED },
    select: {
      id: true,
      title: true,
      slug: true,
      landingPageEnabled: true,
      description: true,
      ...coursePricingSelect,
      thumbnailUrl: true,
      createdAt: true,
      courseVideos: {
        select: {
          durationSeconds: true,
          ratings: {
            select: { rating: true },
          },
        },
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

  const now = new Date();
  return courses
    .map(({ courseVideos, reviews, enrollments, createdAt, ...course }) => {
      const totalDurationSeconds = courseVideos.reduce(
        (total, video) => total + (Number(video.durationSeconds) || 0),
        0,
      );
      const courseRating = reviews.length
        ? Number((reviews.reduce((total, review) => total + Number(review.rating), 0) / reviews.length).toFixed(2))
        : 0;
      const videoRatings = courseVideos.flatMap((video) => video.ratings);
      const videoRating = videoRatings.length
        ? Number((videoRatings.reduce((total, video) => total + Number(video.rating), 0) / videoRatings.length).toFixed(2))
        : 0;
      const rating = courseRating || videoRating;
      const pricing = getCoursePricing(course, now);

      return {
        courseId: course.id,
        slug: course.slug,
        landingPageEnabled: course.landingPageEnabled,
        title: course.title,
        description: course.description,
        rating,
        price: pricing.price,
        discount: pricing.discountPercent,
        totalPayableAmount: pricing.payableAmount,
        pricing,
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

export const getLandingPageReviewsService = async () => {
  return prisma.courseReview.findMany({
    where: {
      course: {
        status: CourseStatus.PUBLISHED,
      },
      user: {
        status: "ACTIVE",
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 30,
    select: {
      id: true,
      rating: true,
      comment: true,
      createdAt: true,
      user: {
        select: {
          name: true,
        },
      },
      course: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });
};

export const getPublishedCourseVideosService = async (courseId, userId) => {
  const now = new Date();
  const enrollment = userId ? await ensureEnrollment(userId, courseId) : null;
  const course = await prisma.yogaCourse.findFirst({
    where: {
      id: courseId,
      status: CourseStatus.PUBLISHED,
    },
    select: {
      id: true,
      title: true,
      sequentialUnlock: true,
      videoGroups: videoGroupSelect,
      courseVideos: {
        where: readyVideoWhere,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          description: true,
          thumbnailUrl: true,
          durationSeconds: true,
          sortOrder: true,
          releaseAt: true,
          groupId: true,
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

  const { videoGroups, ...courseData } = course;
  // "Lock videos in order" applies to buyers only.
  const { videos: courseVideos, nextVideoId } = applySequentialLock(
    applyVideoVisibility(
      course.courseVideos.map(({ completions, ...video }) => ({
        ...video,
        isCompleted: completions.length > 0,
      })),
      { showScheduledAsLocked: enrollment?.isPrelaunchPurchase === true, now },
    ),
    { enabled: Boolean(enrollment) && course.sequentialUnlock },
  );

  return {
    ...courseData,
    courseVideos,
    nextVideoId,
    groups: groupCourseVideos(courseVideos, videoGroups),
  };
};

export const getPublishedCourseDetailsService = async (courseId, userId) => {
  const now = new Date();
  const course = await prisma.yogaCourse.findFirst({
    where: {
      id: courseId,
      status: CourseStatus.PUBLISHED,
    },
    select: {
      id: true,
      title: true,
      slug: true,
      landingPageEnabled: true,
      sequentialUnlock: true,
      description: true,
      status: true,
      ...coursePricingSelect,
      thumbnailUrl: true,
      createdAt: true,
      updatedAt: true,
      enrollments: {
        where: { userId },
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { id: true, status: true, expiresAt: true, isPrelaunchPurchase: true },
      },
      reviews: {
        where: { userId },
        select: { id: true },
        take: 1,
      },
      videoGroups: videoGroupSelect,
      courseVideos: {
        where: readyVideoWhere,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          description: true,
          thumbnailUrl: true,
          durationSeconds: true,
          sortOrder: true,
          releaseAt: true,
          groupId: true,
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

  const { enrollments, reviews, courseVideos, videoGroups, ...courseData } = course;
  const enrollment = enrollments[0];
  const hasActiveEnrollment =
    enrollment?.status === "ACTIVE" && (!enrollment.expiresAt || enrollment.expiresAt > now);
  const allVideosWithCompletion = courseVideos.map(({ completions, ...video }) => ({
    ...video,
    isCompleted: completions.length > 0,
  }));
  // Normal buyers don't see scheduled videos. Prelaunch buyers and people who haven't bought yet
  // see them locked with their release date, so the full curriculum is visible before buying.
  // "Lock videos in order" applies to buyers only; others see the curriculum without it.
  const { videos: visibleVideos, nextVideoId } = applySequentialLock(
    applyVideoVisibility(allVideosWithCompletion, {
      showScheduledAsLocked: !hasActiveEnrollment || enrollment.isPrelaunchPurchase === true,
      now,
    }),
    { enabled: hasActiveEnrollment && courseData.sequentialUnlock },
  );

  return {
    ...withCurrentPricing(courseData, now),
    courseVideos: visibleVideos,
    groups: groupCourseVideos(visibleVideos, videoGroups),
    nextVideoId: hasActiveEnrollment ? nextVideoId : null,
    videoCount: visibleVideos.length,
    releasedVideoCount: allVideosWithCompletion.filter((video) => isVideoReleased(video, now)).length,
    ...getEarliestUpcomingRelease(allVideosWithCompletion, now),
    isPurchased: hasActiveEnrollment,
    isBought: hasActiveEnrollment,
    isPrelaunchPurchase: hasActiveEnrollment && enrollment.isPrelaunchPurchase === true,
    isAccessRevoked: enrollment?.status === "REVOKED",
    hasReviewed: reviews.length > 0,
    // Scheduled videos count too: a course isn't complete while more videos are still coming.
    isCourseCompleted:
      allVideosWithCompletion.length > 0 && allVideosWithCompletion.every((video) => video.isCompleted),
  };
};

export const getCourseVideoPlaybackService = async ({ courseId, videoId, userId }) => {
  const enrollment = await ensureEnrollment(userId, courseId);
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
      releaseAt: true,
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

  // A scheduled video doesn't exist yet for normal buyers; prelaunch buyers are told when it unlocks.
  if (video && !isVideoReleased(video)) {
    if (enrollment.isPrelaunchPurchase) throw createVideoLockedError(video.releaseAt);
  }

  if (!video || !isVideoReleased(video)) {
    const error = new Error(ERROR_MESSAGES.VIDEO_NOT_FOUND);
    error.statusCode = 404;
    throw error;
  }

  // No stream URL for a video the buyer hasn't reached yet when the course locks videos in order.
  await ensureVideoUnlockedInOrder({ userId, courseId, videoId });

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
  const now = new Date();
  const enrollment = userId ? await ensureEnrollment(userId, courseId) : null;
  const course = await prisma.yogaCourse.findFirst({
    where: {
      id: courseId,
      status: CourseStatus.PUBLISHED,
    },
    select: {
      id: true,
      title: true,
      thumbnailUrl: true,
      sequentialUnlock: true,
      videoGroups: videoGroupSelect,
      courseVideos: {
        where: readyVideoWhere,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          description: true,
          thumbnailUrl: true,
          durationSeconds: true,
          sortOrder: true,
          releaseAt: true,
          groupId: true,
          completions: { where: { userId: userId ?? "" }, select: { id: true }, take: 1 },
        },
      },
    },
  });

  if (!course) {
    const error = new Error(ERROR_MESSAGES.COURSE_NOT_FOUND);
    error.statusCode = 404;
    throw error;
  }

  const { videoGroups, ...courseData } = course;
  const { videos: courseVideos, nextVideoId } = applySequentialLock(
    applyVideoVisibility(
      course.courseVideos.map(({ completions, ...video }) => ({ ...video, isCompleted: completions.length > 0 })),
      { showScheduledAsLocked: enrollment?.isPrelaunchPurchase === true, now },
    ),
    { enabled: Boolean(enrollment) && course.sequentialUnlock },
  );

  return {
    ...courseData,
    courseVideos,
    nextVideoId,
    groups: groupCourseVideos(courseVideos, videoGroups),
    videoCount: courseVideos.length,
  };
};

// ---------- Public course landing page (no login) ----------

const publicLandingCourseWhere = (extra = {}) => ({
  status: CourseStatus.PUBLISHED,
  landingPageEnabled: true,
  ...extra,
});

export const getCourseLandingSlugsService = async () =>
  prisma.yogaCourse.findMany({
    where: publicLandingCourseWhere(),
    orderBy: { createdAt: "desc" },
    select: { slug: true, id: true, updatedAt: true },
  }).then((courses) => courses.map(({ id, ...course }) => ({ ...course, courseId: id })));

/**
 * Everything the public /courses/<slug> page needs. Lists every READY video, including scheduled
 * ones (marked as upcoming). It never returns stream URLs or Cloudflare IDs.
 */
export const getCourseLandingBySlugService = async (slug) => {
  const now = new Date();
  const course = await prisma.yogaCourse.findFirst({
    where: publicLandingCourseWhere({ slug }),
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      thumbnailUrl: true,
      updatedAt: true,
      sequentialUnlock: true,
      ...coursePricingSelect,
      landingContent: true,
      videoGroups: videoGroupSelect,
      courseVideos: {
        where: readyVideoWhere,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          description: true,
          thumbnailUrl: true,
          durationSeconds: true,
          sortOrder: true,
          releaseAt: true,
          groupId: true,
        },
      },
      reviews: {
        where: { user: { status: "ACTIVE" } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          user: { select: { name: true } },
        },
      },
      _count: {
        select: {
          enrollments: {
            where: { status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
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

  const curriculum = course.courseVideos.map(({ releaseAt, ...video }, index) => {
    const isUpcoming = !isVideoReleased({ releaseAt }, now);
    return {
      ...video,
      lessonNumber: index + 1,
      durationSeconds: Number(video.durationSeconds) || 0,
      isUpcoming,
      releaseAt: isUpcoming ? releaseAt.toISOString() : null,
      releaseDate: isUpcoming ? utcToIstDate(releaseAt) : null,
    };
  });
  const averageRating = course.reviews.length
    ? Number((course.reviews.reduce((total, review) => total + Number(review.rating), 0) / course.reviews.length).toFixed(2))
    : 0;

  return {
    course: {
      id: course.id,
      slug: course.slug,
      title: course.title,
      description: course.description,
      thumbnailUrl: course.thumbnailUrl,
      updatedAt: course.updatedAt,
      // Shown as "Videos unlock in order" next to the curriculum.
      sequentialUnlock: course.sequentialUnlock,
    },
    pricing: getCoursePricing(course, now),
    content: formatLandingContent(course.landingContent?.content),
    // Public trailer, only once Cloudflare has finished processing it.
    trailer:
      course.landingContent?.trailerStatus === "READY" && course.landingContent.trailerHlsUrl
        ? {
            hlsUrl: course.landingContent.trailerHlsUrl,
            posterUrl: course.landingContent.trailerPosterUrl || course.landingContent.trailerThumbnailUrl || null,
            durationSeconds: course.landingContent.trailerDurationSeconds ?? null,
          }
        : null,
    curriculum,
    // Weeks/groups, when the admin has grouped the videos. Empty: show the curriculum as one list.
    groups: groupCourseVideos(curriculum, course.videoGroups),
    stats: {
      videoCount: curriculum.length,
      totalDurationSeconds: curriculum.reduce((total, video) => total + video.durationSeconds, 0),
      totalStudents: course._count.enrollments,
      averageRating,
      totalReviews: course.reviews.length,
      ...getEarliestUpcomingRelease(course.courseVideos, now),
    },
    reviews: course.reviews
      .filter((review) => review.comment?.trim())
      .slice(0, 9)
      .map((review) => ({
        id: review.id,
        rating: Number(review.rating),
        comment: review.comment,
        createdAt: review.createdAt,
        userName: review.user?.name ?? "Yoga student",
      })),
  };
};
